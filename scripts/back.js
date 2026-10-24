// "‹ 返回" to the author's personal site, shown only to visitors who came from it (web pages only, never the email).
// The personal site leaves 'qxj.back' in this tab's sessionStorage when someone clicks through; a link opened directly
// has nothing set and the link stays hidden. Contract: qinxujunai.github.io repository, docs/back-link.md.
// This is the only script on the web pages; scripts/test/core.test.js allows exactly this one.
export const BACK_ATTR = 'data-qxj-back';
export const BACK_SCRIPT = `<script>(function(){try{var u=sessionStorage.getItem('qxj.back'),a=document.querySelector('[data-qxj-back]');if(!u||!a||u.indexOf(location.origin+'/')!==0)return;a.href=u;a.hidden=false;a.addEventListener('click',function(e){if(document.referrer&&document.referrer.split('#')[0]===u.split('#')[0]){e.preventDefault();history.back();}});}catch(e){}})();</script>`;
