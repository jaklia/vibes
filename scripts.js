

function initSubtitleRotation() {

    const subtitles = [
        "Tiny projects, big vibes.",
        "Now with 87% fewer bugs (probably).",
        "Debugging is my cardio.",
        "100% gluten‑free code.",
        "Made with duct tape and dreams.",
        "Unexpected Token: Vibe.",
        "Powered by keyboard smashing.",
        "Unhandled promise rejection: Sleep undefined.",
        "One div away from greatness.",
        "Built at midnight, judged at noon.",
        "undefined",
    ];

    let index = 0;
    const subtitleEl = document.getElementById("subtitle");

    function updateSubtitle() {
        subtitleEl.style.opacity = 0;
        setTimeout(() => {
            subtitleEl.textContent = subtitles[index];
            subtitleEl.style.opacity = 1;
            index = (index + 1) % subtitles.length;
        }, 600);
    }


    updateSubtitle();
    setInterval(updateSubtitle, 4000);
}