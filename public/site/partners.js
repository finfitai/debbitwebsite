/* The partner program page (/partners): the earnings illustration and the application form.
   The form sends through the site's existing contact endpoint (/api/contact), the same one the homepage
   contact form uses, so an application reaches the same inbox (CONTACT_INBOX). It only says "sent" when that
   endpoint answers ok; any other answer tells the person it was not sent and offers a call instead. */
(function(){
'use strict';
var D=document,$=function(id){return D.getElementById(id)};

/* the Founding 100: one lit seat, 99 open */
var h=D.querySelector('.p-hundred');
if(h){for(var i=0;i<100;i++)h.appendChild(D.createElement('i'))}

/* earnings illustration (proposed terms, example price) */
var n=$('cN'),p=$('cP'),r=$('cR');
if(n&&p&&r){
  var fmt=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
  var upd=function(){
    var N=Math.max(0,Math.round(+n.value||0)),P=Math.max(0,+p.value||0),pct=Math.round(+r.value||0);
    // whole cents, computed once, so the monthly and annual figures always agree
    var grossC=Math.round(N*P*100),shareC=Math.round(grossC*pct/100);
    $('cNOut').textContent=N;
    $('cROut').textContent=pct+'%';
    $('cM').textContent=fmt.format(shareC/100);
    $('cA').textContent=fmt.format(shareC*12/100);
    $('cG').textContent=fmt.format(grossC/100);
    $('cHint').textContent=pct<=20?'Within the proposed Referral range (15–20%).':'Within the proposed Certified range (20–30%).';
  };
  [n,p,r].forEach(function(el){el.addEventListener('input',upd)});
  upd();
}

/* application form */
var f=$('applyForm');
if(!f)return;
var out=$('fMsgOut'),send=$('fSend');
var CALL='<a href="https://cal.com/debbit-zu3rzi/30min?layout=month_view" target="_blank" rel="noopener" data-cal-link="debbit-zu3rzi/30min">book a 30-minute call</a>';
function say(html,bad){out.innerHTML=html;out.classList.toggle('p-bad',!!bad)}
function val(id){var el=$(id);return el?String(el.value||'').trim():''}
f.addEventListener('submit',function(e){
  e.preventDefault();
  var name=$('fName'),email=$('fEmail');
  name.removeAttribute('aria-invalid');email.removeAttribute('aria-invalid');
  if(!val('fName')){name.setAttribute('aria-invalid','true');name.focus();say('Add your name so we know who to reply to.',true);return}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('fEmail'))){email.setAttribute('aria-invalid','true');email.focus();say('Check your work email. It needs to look like name@firm.com.',true);return}
  var message=[
    'Partner Program application',
    'Role: '+val('fRole'),
    'Professional body: '+(val('fBody')||'-'),
    'Business clients served: '+val('fClients'),
    'Path: '+val('fPath'),
    'Rules may restrict commission, show the non-commission path: '+($('fRules').checked?'Yes':'No'),
    '',
    val('fMsg')||'(no message)'
  ].join('\n');
  var body={name:val('fName'),email:val('fEmail'),business:val('fFirm'),country:val('fCountry'),product:'Partner Program',message:message,lang:'en',website:val('fSite')};
  send.setAttribute('aria-busy','true');send.textContent='Sending…';say('');
  fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    .then(function(res){return res.json().catch(function(){return {ok:false}}).then(function(j){return {status:res.status,j:j}})})
    .then(function(x){
      if(x.j&&x.j.ok){f.reset();say('Thank you. Your application was sent, and a member of the founding team will reply to '+escape(body.email)+'.');return}
      if(x.status===429){say('We have had several messages from your connection in the last few minutes. Wait ten minutes and try again, or '+CALL+'.',true);return}
      if(x.j&&x.j.error==='email'){email.setAttribute('aria-invalid','true');email.focus();say('Check your work email. It needs to look like name@firm.com.',true);return}
      say('Your application was not sent. Nothing went wrong on your side. Try again later, or '+CALL+'.',true);
    })
    .catch(function(){say('Your application was not sent, because the connection dropped. Try again, or '+CALL+'.',true)})
    .then(function(){send.removeAttribute('aria-busy');send.textContent='Send application'});
});
function escape(s){return s.replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
})();
