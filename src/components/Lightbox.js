import { h, setText, setVisible } from '../utils/dom.js';
import { imageUrl } from '../utils/format.js';
import '../styles/components.css'; // Just to make sure

export function openLightbox(images, startIndex = 0) {
  let currentIndex = startIndex;

  const dialog = h('dialog', { class: 'lightbox-dialog' });
  
  const container = h('div', { class: 'lightbox-container' });
  
  const imgEl = h('img', { class: 'lightbox-img', alt: 'Gallery Image' });
  
  const counter = h('div', { class: 'lightbox-counter' });
  
  const btnClose = h('button', { class: 'lightbox-btn close', 'aria-label': 'Close' });
  setText(btnClose, 'X');
  
  const btnPrev = h('button', { class: 'lightbox-btn prev', 'aria-label': 'Previous' });
  setText(btnPrev, '◀');
  
  const btnNext = h('button', { class: 'lightbox-btn next', 'aria-label': 'Next' });
  setText(btnNext, '▶');
  
  function update() {
    imgEl.src = imageUrl(images[currentIndex].filePath, 'w1280');
    setText(counter, `${currentIndex + 1} / ${images.length}`);
    btnPrev.disabled = currentIndex === 0;
    btnNext.disabled = currentIndex === images.length - 1;
  }
  
  function next() {
    if (currentIndex < images.length - 1) {
      currentIndex++;
      update();
    }
  }
  
  function prev() {
    if (currentIndex > 0) {
      currentIndex--;
      update();
    }
  }
  
  function close() {
    dialog.close();
    dialog.remove();
  }
  
  btnNext.addEventListener('click', (e) => { e.stopPropagation(); next(); });
  btnPrev.addEventListener('click', (e) => { e.stopPropagation(); prev(); });
  btnClose.addEventListener('click', (e) => { e.stopPropagation(); close(); });
  
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target === container) close();
  });
  
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'Escape') close();
  });
  
  // Swipe support
  let touchStartX = 0;
  dialog.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; });
  dialog.addEventListener('touchend', e => {
    const touchEndX = e.changedTouches[0].screenX;
    if (touchEndX < touchStartX - 50) next();
    if (touchEndX > touchStartX + 50) prev();
  });

  container.appendChild(imgEl);
  container.appendChild(counter);
  container.appendChild(btnPrev);
  container.appendChild(btnNext);
  container.appendChild(btnClose);
  dialog.appendChild(container);
  
  document.body.appendChild(dialog);
  dialog.showModal();
  update();
}
