
// SM Bridge Media - Main JavaScript

document.addEventListener("DOMContentLoaded", () => {

    // MOBILE NAVIGATION
    const menuToggle = document.getElementById("menuToggle");
    const navLinks = document.getElementById("navLinks");

    if (menuToggle && navLinks) {

        const closeMenu = () => {
            navLinks.classList.remove("show");
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Open navigation menu");
        };

        const openMenu = () => {
            navLinks.classList.add("show");
            menuToggle.setAttribute("aria-expanded", "true");
            menuToggle.setAttribute("aria-label", "Close navigation menu");
        };

        menuToggle.addEventListener("click", () => {
            const isOpen = menuToggle.getAttribute("aria-expanded") === "true";

            if (isOpen) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        // Close menu after selecting a navigation link
        navLinks.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", closeMenu);
        });

        // Close menu when clicking outside the navigation
        document.addEventListener("click", event => {
            const clickedInsideMenu = navLinks.contains(event.target);
            const clickedToggle = menuToggle.contains(event.target);

            if (!clickedInsideMenu && !clickedToggle) {
                closeMenu();
            }
        });

        // Close menu with Escape key
        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closeMenu();
                menuToggle.focus();
            }
        });

        // Close mobile menu when returning to desktop layout
        window.addEventListener("resize", () => {
            if (window.innerWidth > 700) {
                closeMenu();
            }
        });

    }

    // AUTOMATIC COPYRIGHT YEAR
    const currentYear = document.getElementById("currentYear");

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

});
