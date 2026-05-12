(function(){
        try{
            var mq = window.matchMedia && window.matchMedia('(max-width: 768px)');
            function apply(m){
                if(m && m.matches){
                    try{ localStorage.setItem('auto:skip','on'); }catch(e){}
                    if(document.body && document.body.classList){ document.body.classList.add('auto-skip-enabled'); }
                }
            }
            apply(mq);
            if(mq && mq.addEventListener) mq.addEventListener('change', function(e){ apply(e); });
            else if(mq && mq.addListener) mq.addListener(function(e){ apply(e); });
            document.addEventListener('DOMContentLoaded', function(){ apply(mq); });
        }catch(e){}
    })();
