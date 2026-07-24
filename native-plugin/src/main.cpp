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

	struct ActiveDialogue
	{
		std::uint32_t speaker = 0;
		std::uint32_t topicInfo = 0;
		std::string text;
	};

	// Identify the currently-displayed subtitle's speaker, then that speaker's active
	// (BEGIN seen, END not yet) TopicInfo FormID. speaker==0 means nothing is
	// displayed; topicInfo==0 means a speaker is displayed but has no active line
	// recorded (shouldn't normally happen once the sink has seen its BEGIN).
	ActiveDialogue ResolveActiveDialogue()
	{
		ActiveDialogue result;
		auto* mgr = RE::SubtitleManager::GetSingleton();
		if (!mgr) {
			return result;
		}

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
					result.speaker = sp->GetFormID();
					result.text = text;
					break;
				}
				if (result.speaker == 0) {
					result.speaker = sp->GetFormID();
					result.text = text;
				}
			}
		}

		if (result.speaker == 0) {
			return result;
		}

		std::lock_guard<std::mutex> lk(g_activeMutex);
		auto it = g_activeBySpeaker.find(result.speaker);
		if (it != g_activeBySpeaker.end()) {
			result.topicInfo = it->second;
		}
		return result;
	}

	// Resolve the plugin (mod file) that defines the given FormID, e.g. "Skyrim.esm"
	// or "Dawnguard.esm". Empty if the form or its origin file can't be found.
	std::string PluginNameFor(std::uint32_t a_formID)
	{
		auto* form = RE::TESForm::LookupByID(a_formID);
		if (!form) {
			return {};
		}
		auto* file = form->GetFile(0);
		return file ? std::string(file->GetFilename()) : std::string{};
	}

	// The real getter the TS layer calls on hotkey: "<Plugin>|<FORMID6>" for the
	// INFO record behind the currently-displayed subtitle line (e.g.
	// "Skyrim.esm|055DF8", "Dawnguard.esm|001A2B"), or "" if nothing translatable
	// is on screen right now. The plugin qualifier keeps DLC lines from colliding
	// with Skyrim.esm lines that share the same low-24-bit FormID.
	//
	// DIAGNOSTIC MODE (2026-07-24): the SKSE log file has not been reliably capturing
	// [QUERY] lines in this troubleshooting session (unclear whether it's flush
	// timing or a stale-file read), so instead of ever returning an empty string,
	// every early-return path returns a distinct, readable placeholder. The TS
	// overlay already shows unknown keys as "<key> 未登録" in red, so this surfaces
	// directly on screen with no log-file dependency. Revert once confirmed.
	RE::BSFixedString GetCurrentDialogueKey(RE::StaticFunctionTag*)
	{
		const auto dlg = ResolveActiveDialogue();
		if (dlg.speaker == 0) {
			logs::info("[QUERY] no displayed subtitle");
			return RE::BSFixedString("DIAG_NO_SUBTITLE");
		}
		if (dlg.topicInfo == 0) {
			logs::info("[QUERY] speaker={:08X} topicInfo=none text=\"{}\"", dlg.speaker, dlg.text);
			return RE::BSFixedString(fmt::format("DIAG_NO_TOPICINFO_speaker{:08X}", dlg.speaker).c_str());
		}

		const std::string plugin = PluginNameFor(dlg.topicInfo);
		if (plugin.empty()) {
			logs::warn("[QUERY] topicInfo={:08X} has no owning plugin file", dlg.topicInfo);
			return RE::BSFixedString(fmt::format("DIAG_NO_PLUGIN_topicInfo{:08X}", dlg.topicInfo).c_str());
		}

		const std::string key = fmt::format("{}|{:06X}", plugin, dlg.topicInfo & 0xFFFFFF);
		logs::info("[QUERY] speaker={:08X} topicInfo={:08X} key={} text=\"{}\"",
			dlg.speaker, dlg.topicInfo, key, dlg.text);
		return RE::BSFixedString(key.c_str());
	}

	bool RegisterPapyrus(RE::BSScript::IVirtualMachine* a_vm)
	{
		a_vm->RegisterFunction("GetTestValue", PapyrusClass, GetTestValue);
		a_vm->RegisterFunction("GetCurrentDialogueKey", PapyrusClass, GetCurrentDialogueKey);
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
