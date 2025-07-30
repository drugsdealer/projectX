'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  size?: string | number;
  postponed?: boolean; 
  quantity?: number; // добавлено
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (index: number) => void;
  discount: number;
  applyDiscount: (percent: number) => void;
  resetDiscount: () => void;
  togglePostponed: (id: number) => void;
  getActiveTotalAmount: () => number;
  getActiveItems: () => CartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  getActiveCount: () => number;
  postponedItems: number[];
  setPostponedItems: React.Dispatch<React.SetStateAction<number[]>>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [postponedItems, setPostponedItems] = useState<number[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedItems = localStorage.getItem("cart");
      if (storedItems) {
        setCartItems(JSON.parse(storedItems));
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("postponedItems", JSON.stringify(postponedItems));
  }, [postponedItems]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("postponedItems");
      if (stored) {
        setPostponedItems(JSON.parse(stored));
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cart", JSON.stringify(cartItems));
    }
  }, [cartItems]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("discount");
      if (stored) setDiscount(parseFloat(stored));
    }
  }, []);

  useEffect(() => {
    if (cartItems.length === 0 && discount > 0) {
      setDiscount(0);
      localStorage.removeItem("discount");
      localStorage.removeItem("promoCode");
    }
  }, [cartItems, discount]);

  const addToCart = (item: CartItem) => {
    setCartItems((prev) => [...prev, { ...item, postponed: false }]);
  };

  const removeFromCart = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  const applyDiscount = (percent: number) => {
    setDiscount(percent);
    localStorage.setItem("discount", percent.toString());
  };

  const resetDiscount = () => {
    setDiscount(0);
    localStorage.removeItem("discount");
    localStorage.removeItem("promoCode");
  };

  const togglePostponed = (id: number) => {
    setPostponedItems((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const getActiveItems = () => {
    return cartItems.filter((item) => !postponedItems.includes(item.id));
  };

  const getActiveTotalAmount = () => {
    return cartItems
      .filter((item) => !postponedItems.includes(item.id))
      .reduce((sum, item) => sum + item.price, 0);
  };

  const getActiveCount = () => {
    return cartItems.filter((item) => !postponedItems.includes(item.id)).length;
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        discount,
        applyDiscount,
        resetDiscount,
        togglePostponed,
        getActiveTotalAmount,
        setCartItems,
        getActiveItems,
        getActiveCount,
        postponedItems,
        setPostponedItems
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context)
    throw new Error("useCart must be used within CartProvider");
  return context;
};

export { useCart };