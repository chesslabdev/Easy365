/**
 * Mede a altura do header custom e do header-group e expõe como CSS vars.
 * - --hc-header-h: altura da seção do header (usada no overlay da home)
 * - --header-group-height / --header-height: compat com componentes do tema (sticky CTA etc.),
 *   já que o header nativo (header-component) não está mais na página.
 * - --account-offset-top: posição (viewport) do FUNDO da barra, para o popover da conta
 *   ancorar logo abaixo do ícone — correto na home (flutuante) e ao rolar (sticky).
 */
function setHeaderVars() {
  const section = document.querySelector('.header-custom-section');
  const group = document.querySelector('#header-group');
  const headerH = section ? section.offsetHeight : 0;

  document.documentElement.style.setProperty('--hc-header-h', `${headerH}px`);
  document.body.style.setProperty('--header-height', `${headerH}px`);

  let groupH = 0;
  if (group) {
    for (const child of group.children) groupH += child.offsetHeight || 0;
  }
  document.body.style.setProperty('--header-group-height', `${groupH || headerH}px`);
}

/** Ancoragem do popover da conta = posição real do fundo da barra (viewport). */
function setAccountOffset() {
  const hc = document.querySelector('.hc');
  const bar = document.querySelector('.hc .hc__bar') || hc;
  if (!hc || !bar) return;
  const bottom = Math.round(bar.getBoundingClientRect().bottom);
  hc.style.setProperty('--account-offset-top', `${bottom}px`);
}

function update() {
  setHeaderVars();
  setAccountOffset();
}

update();
window.addEventListener('load', update);
window.addEventListener('resize', update);
window.addEventListener('scroll', setAccountOffset, { passive: true });
