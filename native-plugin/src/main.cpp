#include "pch.h"

#include <mutex>
#include <string>
#include <unordered_map>

namespace
{
	// speaker FormID -> currently-active (BEGIN seen, END not yet) TopicInfo FormID.
	// Phase 1b established: a genuinely-spoken line keeps its TopicInfo active for the
	// whole playback (BEGIN..END seconds apart), while background scene-evaluation noise
	// fires BEGIN+END in the same instant, so it never lingers here. Guarded by a mutex
	// because the event sink and the Papyrus native run on different threads.
	std::mutex g_activeMutex;
	std::unordered_map<std::uint32_t, std::uint32_t> g_activeBySpeaker;

	class TopicInfoSink final :
		public REX::Singleton<TopicInfoSink>,
		public RE::BSTEventSink<RE::TESTopicInfoEvent>
	{
	public:
		RE::BSEventNotifyControl ProcessEvent(const RE::TESTopicInfoEvent* a_event,
			RE::BSTEventSource<RE::TESTopicInfoEvent>*) override
		{
			if (!a_event) {
				return RE::BSEventNotifyControl::kContinue;
			}
			auto speaker = a_event->speakerRef.get();
			if (!speaker) {
				return RE::BSEventNotifyControl::kContinue;
			}

			const std::uint32_t speakerFormID = speaker->GetFormID();
			const std::uint32_t topicInfo = a_event->topicInfoFormID;
			const bool begin = a_event->type == RE::TESTopicInfoEvent::TopicInfoEventType::kTopicBegin;

			std::lock_guard<std::mutex> lk(g_activeMutex);
			if (begin) {
				g_activeBySpeaker[speakerFormID] = topicInfo;
			} else {
				// Only clear if this END matches the line we recorded, so a stale END
				// can't wipe a newer BEGIN for the same speaker.
				auto it = g_activeBySpeaker.find(speakerFormID);
				if (it != g_activeBySpeaker.end() && it->second == topicInfo) {
					g_activeBySpeaker.erase(it);
				}
			}
			return RE::BSEventNotifyControl::kContinue;
		}

		static void Register()
		{
			auto* holder = RE::ScriptEventSourceHolder::GetSingleton();
			if (!holder) {
				logs::warn("ScriptEventSourceHolder unavailable; TESTopicInfoEvent sink not registered");
				return;
			}
			holder->AddEventSink<RE::TESTopicInfoEvent>(GetSingleton());
			logs::info("TESTopicInfoEvent sink registered");
		}
	};

	constexpr std::string_view PapyrusClass = "JpSubtitle";

	// Kept from the Phase 3a bridge spike as a sanity probe.
	std::int32_t GetTestValue(RE::StaticFunctionTag*)
	{
		return 0x12345;
	}

	// The real getter the TS layer calls on hotkey: identify the currently-displayed
	// subtitle, take its speaker, and return that speaker's active TopicInfo FormID
	// (0 = nothing translatable right now). Returned as Int; the TS side reads it
	// unsigned. The FormID keys the offline JP lookup table.
	std::int32_t GetCurrentDialogueFormID(RE::StaticFunctionTag*)
	{
		auto* mgr = RE::SubtitleManager::GetSingleton();
		if (!mgr) {
			return 0;
		}

		std::uint32_t chosenSpeaker = 0;
		std::string chosenText;
		{
			RE::BSSpinLockGuard guard(mgr->lock);
			const auto count = mgr->subtitles.size();
			for (std::size_t i = 0; i < count; ++i) {
				const auto& info = mgr->subtitles[i];
				const char* text = info.subtitle.c_str();
				if (!text || !text[0]) {
					continue;
				}
				auto sp = info.speaker.get();
				if (!sp) {
					continue;
				}
				// Conversation dialogue is forceDisplay=true - prefer it. Otherwise
				// remember the first non-empty line as a fallback.
				if (info.forceDisplay) {
					chosenSpeaker = sp->GetFormID();
					chosenText = text;
					break;
				}
				if (chosenSpeaker == 0) {
					chosenSpeaker = sp->GetFormID();
					chosenText = text;
				}
			}
		}

		if (chosenSpeaker == 0) {
			logs::info("[QUERY] no displayed subtitle");
			return 0;
		}

		std::uint32_t topicInfo = 0;
		{
			std::lock_guard<std::mutex> lk(g_activeMutex);
			auto it = g_activeBySpeaker.find(chosenSpeaker);
			if (it != g_activeBySpeaker.end()) {
				topicInfo = it->second;
			}
		}

		logs::info("[QUERY] speaker={:08X} topicInfo={:08X} text=\"{}\"", chosenSpeaker, topicInfo, chosenText);
		return static_cast<std::int32_t>(topicInfo);
	}

	bool RegisterPapyrus(RE::BSScript::IVirtualMachine* a_vm)
	{
		a_vm->RegisterFunction("GetTestValue", PapyrusClass, GetTestValue);
		a_vm->RegisterFunction("GetCurrentDialogueFormID", PapyrusClass, GetCurrentDialogueFormID);
		logs::info("Papyrus functions registered");
		return true;
	}

	void OnMessage(SKSE::MessagingInterface::Message* a_msg)
	{
		if (a_msg->type == SKSE::MessagingInterface::kDataLoaded) {
			logs::info("kDataLoaded received");
			TopicInfoSink::Register();
		}
	}
}

SKSEPluginLoad(const SKSE::LoadInterface* a_skse)
{
	SKSE::Init(a_skse);
	logs::info("jp-subtitle-spike loaded");

	if (auto* messaging = SKSE::GetMessagingInterface()) {
		messaging->RegisterListener(OnMessage);
	}

	if (!SKSE::GetPapyrusInterface()->Register(RegisterPapyrus)) {
		logs::critical("Failed to register Papyrus functions");
		return false;
	}

	return true;
}
