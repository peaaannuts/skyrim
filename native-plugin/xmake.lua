includes("lib/commonlibsse-ng")
set_project("jp-subtitle-spike")
set_version("0.1.0")
set_languages("c++23")
add_rules("mode.debug", "mode.releasedbg")

target("jp-subtitle-spike")
    add_rules("commonlibsse-ng.plugin", {
        name = "jp-subtitle-spike",
        author = "peaaanut29",
        description = "Phase 1 spike: poll RE::SubtitleManager and log subtitle text/speaker to verify the JP-overlay detection approach"
    })
    add_files("src/**.cpp")
    add_includedirs("src")
    set_pcxxheader("src/pch.h")
