// Scroll Reveal Animations - Apple Style
document.addEventListener('DOMContentLoaded', () => {
    // Select all elements with the 'reveal' class
    const reveals = document.querySelectorAll('.reveal');

    // Create a new Intersection Observer
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if(entry.isIntersecting) {
                // Add the active class when the element comes into view
                entry.target.classList.add('active');
                // Unobserve after revealing to prevent refiring and save performance
                observer.unobserve(entry.target);
            }
        });
    }, {
        root: null, // viewport
        threshold: 0.15, // Fire when 15% of the element is visible
        rootMargin: "0px 0px -50px 0px" // Trigger slightly before it hits the true bottom
    });

    // Observe each element
    reveals.forEach(reveal => {
        revealObserver.observe(reveal);
    });

    // Immediate reveal for navbar elements and initial hero content that might be above the fold
    setTimeout(() => {
        const topReveals = document.querySelectorAll('.hero .reveal, .navbar.reveal');
        topReveals.forEach(el => el.classList.add('active'));
    }, 100);
});
