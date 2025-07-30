"use client";
import { SortPopup } from "@/components/shared";
import { Categories } from "@/components/shared/categories";
import { Container } from "@/components/shared/container";
import { Title } from "@/components/shared/title";
import { TopBar } from "@/components/shared/top-bar";
import { Filters } from "@/components/shared/filters";
import { ProductsGroupList } from "@/components/shared/products-group-list";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { productCategories } from '@/data/products';


export default function Home() {
  const [showAnimation, setShowAnimation] = useState(false);
  const searchParams = useSearchParams();
  

  useEffect(() => {
    if (searchParams.get("premium") === "true") {
      setShowAnimation(true);
      setTimeout(() => {
        setShowAnimation(false);
      }, 1500);
    }
  }, [searchParams]);
  return (
    <>
      {/* Анимация Premium */}
      <AnimatePresence>
        {showAnimation && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="fixed bottom-0 left-0 right-0 h-screen bg-black flex justify-center items-center text-white text-4xl font-bold z-50"
          >
            <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 1 }} className="relative">
              Premium
              <Image src="/img/звезддочкиии.png" alt="Stars" width={40} height={40} className="absolute -top-4 -right-4 animate-spin" />
              <Image src="/img/звездочкиии.png" alt="Stars" width={40} height={40} className="absolute -bottom-4 -left-4 animate-spin" />
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      <Container className="mt-10">
        <Title text="Каталог" size="lg" className="font-extrabold" />
      </Container>
      <TopBar />

      <Container className="mt-10 pb-14">
  <div className="flex gap-[80px]">
    <div className="w-[250px]">
      <Filters />
    </div>

    <div className="flex-1">
      <div className="flex flex-col gap-16">
        {Object.entries(productCategories).map(([key, items], index) => (
          <ProductsGroupList
            key={key}
            title={key}
            items={items}
            categoryId={index + 1}
          />
        ))}
      </div>
    </div>
  </div>
</Container>
    </>
  );
}
