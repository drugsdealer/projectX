"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

// useSearchParams на кэшируемой странице переводит в браузерную отрисовку всё дерево до
// ближайшего Suspense. Читаем адрес в крошечном компоненте под собственным Suspense —
// тогда остальная страница рендерится на сервере и попадает в HTML для поисковиков.
function Watcher({ onChange }: { onChange: (params: URLSearchParams) => void }) {
  const params = useSearchParams();
  const query = params.toString();
  useEffect(() => {
    onChange(new URLSearchParams(query));
    // onChange — сеттер состояния, он стабилен
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  return null;
}

export default function SearchParamsWatcher({ onChange }: { onChange: (params: URLSearchParams) => void }) {
  return (
    <Suspense fallback={null}>
      <Watcher onChange={onChange} />
    </Suspense>
  );
}
