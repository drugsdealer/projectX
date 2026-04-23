"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";

const YM_ID = 108732905;

declare global {
  interface Window {
    ym?: (...args: any[]) => void;
  }
}

function YandexMetrikaTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    window.ym?.(YM_ID, "hit", url);
  }, [pathname, searchParams]);

  return null;
}

export default function YandexMetrika() {
  return (
    <>
      <Script
        id="ym-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
(function(m,e,t,r,i,k,a){
  m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');
ym(${YM_ID},'init',{
  webvisor:true,
  clickmap:true,
  ecommerce:"dataLayer",
  accurateTrackBounce:true,
  trackLinks:true
});`,
        }}
      />
      <noscript>
        <div>
          <img
            src={`https://mc.yandex.ru/watch/${YM_ID}`}
            style={{ position: "absolute", left: -9999 }}
            alt=""
          />
        </div>
      </noscript>
      <YandexMetrikaTracker />
    </>
  );
}
