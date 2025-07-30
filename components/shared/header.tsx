'use client';

import { cn } from "@/lib/utils";
import { Container } from "./container";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "../ui/button";
import { ShoppingCart, UserRound, CircleChevronRight } from "lucide-react";
import { useTitle } from "@/context/TitleContext";
import { useCart } from "@/context/CartContext";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useDiscount } from "@/context/DiscountContext";



interface Props {
  className?: string;
}

export const Header: React.FC<Props> = ({ className }) => {
  const { title } = useTitle();
  const { cartItems, postponedItems } = useCart();

  const activeItems = cartItems.filter(item => !postponedItems.includes(item.id));
  const activeTotalAmount = activeItems.reduce((sum, item) => sum + item.price, 0);
  const { discount, setDiscount } = useDiscount();

  useEffect(() => {
    const d = localStorage.getItem("discount");
    if (d) setDiscount(parseFloat(d));
    else setDiscount(0);
  }, []);

  return (
    <header className={cn('border border-b', className)}>
      <Container className="flex items-center justify-between py-8">
        <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition">
          <Image src="/img/IMG_0363.PNG" alt="Logo" width={85} height={80} />
          <div>
            <h1 className="text-2xl uppercase font-black">{title}</h1>
            <p className="text-sm text-gray-400 leading-3">Магазин</p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/user">
            <Button variant="outline" className="flex items-center gap-1.5">
              <UserRound size={16} />
              Войти
            </Button>
          </Link>
          <Link href="/cart">
        <Button className="group relative px-5 py-3 flex items-center justify-between gap-4 min-w-[160px]">
            <div className="text-sm font-semibold leading-tight text-left">
            <AnimatePresence mode="wait">
                <motion.div
                key={discount > 0 ? 'discounted' : 'normal'}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.25 }}
                >
                {discount > 0 ? (
                    <>
                    <div className="text-white text-lg font-bold">${(activeTotalAmount * (1 - discount)).toLocaleString()}</div>
                    <div className="text-xs text-gray-400 line-through -mt-1">${activeTotalAmount.toLocaleString()}</div>
                    </>
                ) : (
                    <div className="text-white text-lg font-bold">${activeTotalAmount.toLocaleString()}</div>
                )}
                </motion.div>
            </AnimatePresence>
            </div>
            <div className="flex items-center gap-1 transition-all duration-300 group-hover:opacity-0">
            <ShoppingCart className="h-4 w-4 text-white" strokeWidth={2} />
          <b className="text-white">{activeItems.length}</b>
            </div>

            <CircleChevronRight
            size={20}
            className="absolute right-5 top-1/2 -translate-y-1/2 translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-white"
            />
        </Button>
        </Link>
        </div>
      </Container>
    </header>
  );
};