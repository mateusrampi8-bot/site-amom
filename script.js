/* ========================================
   AMOM — script.js
   Three.js scene + interactions
   ======================================== */

(function () {
  'use strict';

  /* ----------------------------------------
     HELPERS
     ---------------------------------------- */
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.innerWidth <= 768;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ----------------------------------------
     NAVBAR — hamburger
     ---------------------------------------- */
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    mobileMenu.classList.toggle('active');
    document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
  });

  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('active');
      mobileMenu.classList.remove('active');
      document.body.style.overflow = '';
    });
  });

  /* ----------------------------------------
     SCROLL REVEAL
     ---------------------------------------- */
  const revealElements = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const siblings = Array.from(el.parentElement.children).filter(c => c.classList.contains('reveal'));
        const idx = siblings.indexOf(el);
        const delay = prefersReduced ? 0 : idx * 80;
        setTimeout(() => el.classList.add('revealed'), delay);
        revealObserver.unobserve(el);
      }
    });
  }, { threshold: 0.15 });

  revealElements.forEach(el => revealObserver.observe(el));

  /* ----------------------------------------
     TILT on cards & conceito image
     ---------------------------------------- */
  if (!isMobile && !prefersReduced) {
    const tiltTargets = document.querySelectorAll('[data-tilt], .drop__card');
    tiltTargets.forEach(el => {
      el.style.transformStyle = 'preserve-3d';
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        el.style.transform = `perspective(600px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transition = 'transform 0.4s ease';
        el.style.transform = 'perspective(600px) rotateY(0) rotateX(0)';
        setTimeout(() => { el.style.transition = ''; }, 400);
      });
    });
  }

  /* ----------------------------------------
     MODAL
     ---------------------------------------- */
  const modal = document.getElementById('modal');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalClose = document.getElementById('modalClose');
  const modalImg = document.getElementById('modalImg');
  const modalName = document.getElementById('modalName');
  const modalPrice = document.getElementById('modalPrice');
  const modalDesc = document.getElementById('modalDesc');
  const modalCta = document.getElementById('modalCta');

  document.querySelectorAll('.drop__card').forEach(card => {
    card.addEventListener('click', () => {
      const img = card.querySelector('img').src;
      const name = card.dataset.name;
      const price = card.dataset.price;
      const desc = card.dataset.desc;
      const msg = encodeURIComponent(`Olá! Tenho interesse na ${name} do DROP 01 da AMOM.`);
      modalImg.src = img;
      modalImg.alt = name;
      modalName.textContent = name;
      modalPrice.textContent = price;
      modalDesc.textContent = desc;
      modalCta.href = `https://wa.me/5500000000000?text=${msg}`;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  modalOverlay.addEventListener('click', closeModal);
  modalClose.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  /* ----------------------------------------
     THREE.JS — Hero Scene
     ---------------------------------------- */
  const canvas = document.getElementById('heroCanvas');
  const fallback = document.getElementById('heroFallback');
  const heroSection = document.getElementById('hero');

  window.__three_ok = true;

  if (prefersReduced) {
    window.__three_ok = false;
    canvas.style.display = 'none';
    fallback.classList.add('active');
  }

  let scene, camera, renderer, particles, clock;
  let mouseX = 0, mouseY = 0;
  let targetMouseX = 0, targetMouseY = 0;
  let scrollY = 0;
  let rafId = null;
  let heroInView = true;

  function initThree() {
    try {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.z = 5;

      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      clock = new THREE.Clock();

      // Particle grid
      const count = isMobile ? 1200 : 2400;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);

      const gridWidth = 12;
      const gridHeight = 8;
      const cols = Math.round(Math.sqrt(count * (gridWidth / gridHeight)));
      const rows = Math.round(count / cols);

      let idx = 0;
      for (let j = 0; j < rows && idx < count; j++) {
        for (let i = 0; i < cols && idx < count; i++) {
          const x = (i / (cols - 1) - 0.5) * gridWidth;
          const y = (j / (rows - 1) - 0.5) * gridHeight;
          positions[idx * 3] = x;
          positions[idx * 3 + 1] = y;
          positions[idx * 3 + 2] = 0;
          idx++;
        }
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      // Shader material for smoke + accent micro-glow
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(0x1b1d20) },
          uAccent: { value: new THREE.Color(0xc8ff3d) },
          uPixelRatio: { value: renderer.getPixelRatio() },
        },
        vertexShader: `
          uniform float uTime;
          uniform float uPixelRatio;
          varying float vElevation;
          void main() {
            vec3 pos = position;
            float noise = sin(pos.x * 1.2 + uTime * 0.4) * cos(pos.y * 0.8 + uTime * 0.3) * 0.35;
            noise += sin(pos.x * 2.5 - uTime * 0.2) * cos(pos.y * 1.8 + uTime * 0.5) * 0.12;
            pos.z = noise;
            vElevation = noise;
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = (2.0 * uPixelRatio) / -mvPosition.z;
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform vec3 uAccent;
          varying float vElevation;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            float glow = smoothstep(0.15, 0.0, d);
            vec3 col = mix(uColor, uAccent, glow * 0.35 + smoothstep(0.2, 0.5, vElevation) * 0.15);
            float alpha = smoothstep(0.5, 0.15, d) * 0.7;
            gl_FragColor = vec4(col, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
      });

      particles = new THREE.Points(geometry, material);
      scene.add(particles);

    } catch (e) {
      window.__three_ok = false;
      canvas.style.display = 'none';
      fallback.classList.add('active');
    }
  }

  function animateThree() {
    if (!window.__three_ok) return;
    rafId = requestAnimationFrame(animateThree);

    const elapsed = clock.getElapsedTime();

    // Mouse lerp
    mouseX = lerp(mouseX, targetMouseX, 0.06);
    mouseY = lerp(mouseY, targetMouseY, 0.06);

    // Camera parallax from scroll
    const scrollNorm = scrollY / (heroSection.offsetHeight || 1);
    camera.position.y = -scrollNorm * 1.5;
    camera.rotation.x = scrollNorm * 0.15;

    // Mouse tilt
    camera.rotation.y = mouseX * 0.035;
    camera.rotation.x += mouseY * 0.02;

    // Update uniforms
    if (particles) {
      particles.material.uniforms.uTime.value = elapsed;
    }

    renderer.render(scene, camera);
  }

  // Hero visibility observer — pause RAF when not in view
  const heroObserver = new IntersectionObserver((entries) => {
    heroInView = entries[0].isIntersecting;
    if (heroInView && !rafId && window.__three_ok) {
      animateThree();
    } else if (!heroInView && rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }, { threshold: 0 });

  // Mouse tracking
  document.addEventListener('mousemove', (e) => {
    targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // Scroll tracking
  window.addEventListener('scroll', () => {
    scrollY = window.pageYOffset;
  }, { passive: true });

  // Resize
  window.addEventListener('resize', () => {
    if (!window.__three_ok) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Init
  if (!prefersReduced) {
    initThree();
    heroObserver.observe(heroSection);
    if (window.__three_ok) animateThree();
  } else {
    canvas.style.display = 'none';
    fallback.classList.add('active');
  }

  /* ----------------------------------------
     3D EFFECTS — Dynamic Shadows & Parallax
     ---------------------------------------- */
  
  // Dynamic shadow effect for cards
  if (!isMobile && !prefersReduced) {
    const cards = document.querySelectorAll('.drop__card');
    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mouse-x', `${x}%`);
        card.style.setProperty('--mouse-y', `${y}%`);
      });
    });
  }

  // Parallax effect for hero section
  if (!prefersReduced) {
    const heroContent = document.querySelector('.hero__content');
    const heroTitle = document.querySelector('.hero__title');
    const heroSub = document.querySelector('.hero__sub');
    
    if (heroContent && heroTitle && heroSub) {
      window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const rate = scrolled * 0.3;
        const titleRate = scrolled * 0.5;
        const subRate = scrolled * 0.4;
        
        heroContent.style.transform = `translateY(${rate}px)`;
        heroTitle.style.transform = `translateZ(50px) translateY(${titleRate}px)`;
        heroSub.style.transform = `translateZ(30px) translateY(${subRate}px)`;
      }, { passive: true });
    }
  }

  // Parallax effect for sections
  if (!prefersReduced) {
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      
      window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const rate = (scrolled - sectionTop) / sectionHeight;
        
        if (rate >= -1 && rate <= 1) {
          const parallaxElements = section.querySelectorAll('[data-parallax]');
          parallaxElements.forEach(el => {
            const speed = parseFloat(el.dataset.parallax) || 0.5;
            const yPos = -(rate * speed * 100);
            el.style.transform = `translateY(${yPos}px)`;
          });
        }
      }, { passive: true });
    });
  }

})();
