import Link from "next/link";
import Image from "next/image";

interface Props {
  id: number;
  name: string;
  imageUrl: string;
  price: number;
}

export const ProductCard: React.FC<Props> = ({ id, name, imageUrl, price }) => {
  return (
    <Link href={`/product/${id}`}> {/* Ссылка на детальную страницу */}
      <div className="border p-4 rounded-lg cursor-pointer hover:shadow-lg transition">
        <Image
          src={imageUrl}
          alt={name}
          width={300}
          height={300}
          className="object-cover w-full h-[300px] rounded"
        />
        <h2 className="mt-2 text-lg font-bold">{name}</h2>
        <p className="text-gray-500">{price} $</p>
      </div>
    </Link>
  );
};
