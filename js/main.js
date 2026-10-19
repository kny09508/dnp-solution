// ============================================================
// DNP Solution - 공통 스크립트 (main.js)
// nav / 드롭다운 / 모바일메뉴 / 리빌 애니메이션 / 모달 / 폼 전송
// ============================================================

window.addEventListener('scroll', () => {
  const nav = document.getElementById('site-nav');
  if (!nav) return;
  if (window.scrollY > 30) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
});

const hamburger = document.querySelector('.hamburger');
const mobileMenu = document.getElementById('mobile-menu');
const scrim = document.getElementById('menu-scrim');
function toggleMenu(show) {
  if (!mobileMenu || !scrim) return;
  mobileMenu.classList.toggle('open', show);
  scrim.classList.toggle('open', show);
  if (!show) {
    const mbd = document.getElementById('mobile-biz-dropdown');
    if (mbd) mbd.classList.remove('open');
  }
}
if (hamburger) hamburger.addEventListener('click', () => toggleMenu(true));
if (scrim) scrim.addEventListener('click', () => toggleMenu(false));
// 최상위 메뉴 링크 클릭 시에만 모바일 메뉴 전체를 닫음 (드롭다운 토글 링크는 제외)
document.querySelectorAll('.mobile-menu > a').forEach(a => a.addEventListener('click', () => toggleMenu(false)));

// ============ 사업영역 드롭다운 (데스크톱) ============
const bizDropdown = document.getElementById('nav-biz-dropdown');
const bizToggle = document.getElementById('nav-biz-toggle');
if (bizDropdown && bizToggle) {
  bizToggle.addEventListener('click', (e) => {
    e.preventDefault();
    bizDropdown.classList.toggle('open');
  });
  bizDropdown.querySelectorAll('.nav-dropdown-menu a').forEach(a => {
    a.addEventListener('click', () => bizDropdown.classList.remove('open'));
  });
  document.addEventListener('click', (e) => {
    if (!bizDropdown.contains(e.target)) bizDropdown.classList.remove('open');
  });
}

// ============ 사업영역 드롭다운 (모바일) ============
const mobileBizDropdown = document.getElementById('mobile-biz-dropdown');
const mobileBizToggle = document.getElementById('mobile-biz-toggle');
if (mobileBizDropdown && mobileBizToggle) {
  mobileBizToggle.addEventListener('click', (e) => {
    e.preventDefault();
    mobileBizDropdown.classList.toggle('open');
  });
  mobileBizDropdown.querySelectorAll('.mobile-dropdown-menu a').forEach(a => {
    a.addEventListener('click', () => toggleMenu(false));
  });
}

// ============ 스크롤 등장 애니메이션 (data-reveal 요소) ============
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });
document.querySelectorAll('[data-reveal]').forEach(el => revealObserver.observe(el));

// ============ 상담 모달 ============
const modal = document.getElementById('modal-overlay');
document.querySelectorAll('[data-open-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (modal) modal.classList.add('open');
    toggleMenu(false);
  });
});
document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => { if (modal) modal.classList.remove('open'); });
});

// 빠른 견적 카드 최소화 / 복원 토글 (홈페이지에만 존재, 있을 때만 동작)
const floatCard = document.getElementById('floating-quote');
const fcMinimizeBtn = document.getElementById('fc-minimize-btn');
if (floatCard && fcMinimizeBtn) {
  fcMinimizeBtn.addEventListener('click', () => {
    const isMinimized = floatCard.classList.toggle('minimized');
    fcMinimizeBtn.innerHTML = isMinimized ? '&#9723;' : '&#8722;';
    const label = isMinimized ? '펼치기' : '최소화';
    fcMinimizeBtn.setAttribute('title', label);
    fcMinimizeBtn.setAttribute('aria-label', label);
  });
}

// 푸터 영역에 도달하면 빠른 견적 카드를 자연스럽게 숨김 (푸터에 이미 상담 폼이 있으므로 중복 노출 방지)
const footerEl = document.getElementById('contact');
if (floatCard && footerEl) {
  const footerObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      floatCard.classList.toggle('near-footer', entry.isIntersecting);
    });
  }, { threshold: 0.05 });
  footerObserver.observe(footerEl);
}

// 사용자가 유입될 때 사용한 검색 키워드를 추정 (URL 파라미터 → 검색 포털 리퍼러 순으로 확인)
function getSearchKeyword() {
  try {
    const params = new URLSearchParams(window.location.search);
    const paramKeys = ['keyword', 'utm_term', 'kw', 'q', 'query'];
    for (const key of paramKeys) {
      const v = params.get(key);
      if (v) return v;
    }
    const ref = document.referrer;
    if (ref) {
      const refUrl = new URL(ref);
      const host = refUrl.hostname;
      const refParams = refUrl.searchParams;
      if (host.includes('naver.com')) return refParams.get('query') || refParams.get('q') || '';
      if (host.includes('google.')) return refParams.get('q') || '';
      if (host.includes('daum.net') || host.includes('kakao.com')) return refParams.get('q') || '';
      if (host.includes('bing.com')) return refParams.get('q') || '';
    }
  } catch (err) { /* noop */ }
  return '';
}

// "2026. 7. 30. AM 9:00:41" 형식의 신청 일시 문자열 생성
function formatApplyDate(d) {
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  let hour = d.getHours();
  const ampm = hour < 12 ? 'AM' : 'PM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${year}. ${month}. ${day}. ${ampm} ${hour}:${min}:${sec}`;
}

async function handleFormSubmit(e, target) {
  e.preventDefault();
  // 기존 호출(boolean)과 새 호출(prefix 문자열) 모두 지원
  let prefix;
  let isModal = false;
  if (target === true) { prefix = 'm-'; isModal = true; }
  else if (target === false) { prefix = 'q-'; }
  else { prefix = target; isModal = (target === 'm-'); }

  const formEl = e.target;
  const submitBtn = formEl.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn ? submitBtn.textContent : '';

  const company = document.getElementById(prefix + 'company').value;
  const name = document.getElementById(prefix + 'name').value;
  const phone = document.getElementById(prefix + 'phone').value;
  const email = document.getElementById(prefix + 'email').value;
  const field = document.getElementById(prefix + 'field').value;
  const msg = document.getElementById(prefix + 'msg').value;

  const dateString = formatApplyDate(new Date());
  const keyword = getSearchKeyword();

  const formData = new FormData();
  formData.append('name', name);
  formData.append('company', company);
  formData.append('phone', phone);
  formData.append('email', email);
  formData.append('field', field);
  formData.append('message', msg);
  formData.append('keyword', keyword || '확인되지 않음');
  formData.append('submitted_at', dateString);

  const fileInput = document.getElementById(prefix + 'file');
  const files = fileInput && fileInput.files ? Array.from(fileInput.files) : [];
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > 5 * 1024 * 1024) {
    alert('첨부파일의 합계 크기는 5MB 이하로 제한됩니다.');
    return;
  }
  for (const file of files) {
    formData.append('attachments', file, file.name);
  }
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '전송 중...';
  }

  try {
    const res = await fetch('/api/contact', {
  method: 'POST',
  body: formData
});
const result = await res.json();
if (!res.ok || result.success !== true) {
  throw new Error(result.message || '전송 실패');
}

    alert('상담 신청이 정상적으로 접수되었습니다. 빠른 시일 내에 담당 엔지니어가 연락드리겠습니다.');
    if (typeof gtag_report_conversion === 'function') {
      gtag_report_conversion();
    }
    formEl.reset();
    if (isModal && modal) modal.classList.remove('open');
  } catch (err) {
    alert('메일 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해주시거나 전화(070-5015-2189)로 문의해주세요.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  }
}
