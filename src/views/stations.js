import { esc } from '../ui/kit.js';

export function mount(root) {
  root.innerHTML = `<div class="page"><h1>Find food near you</h1><p class="sub">${esc('Public food stations are coming online.')}</p></div>`;
  return {};
}
