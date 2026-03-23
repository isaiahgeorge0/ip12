export type PublicPropertyType = "House" | "Flat" | "Studio" | "Other";

export type PublicProperty = {
  id: string;
  price: number;
  address: string;
  location: string;
  beds: number;
  baths: number;
  propertyType: PublicPropertyType;
  description: string;
  images: string[];
};

export const mockProperties: PublicProperty[] = [
  {
    id: "p-1001",
    price: 975,
    address: "12 Example Street",
    location: "Ipswich",
    beds: 2,
    baths: 1,
    propertyType: "Flat",
    description:
      "A bright, well-laid-out flat with modern fixtures and a comfortable living space.",
    images: ["Gallery 1", "Gallery 2", "Gallery 3"],
  },
  {
    id: "p-1002",
    price: 1245,
    address: "34 Harbour Lane",
    location: "Ipswich",
    beds: 3,
    baths: 2,
    propertyType: "House",
    description:
      "Spacious family home with plenty of storage, light-filled rooms, and a practical layout.",
    images: ["Gallery 1", "Gallery 2", "Gallery 3"],
  },
  {
    id: "p-1003",
    price: 650,
    address: "8 Station Road",
    location: "Suffolk",
    beds: 1,
    baths: 1,
    propertyType: "Studio",
    description:
      "A compact studio designed for effortless living, close to local amenities.",
    images: ["Gallery 1", "Gallery 2", "Gallery 3"],
  },
  {
    id: "p-1004",
    price: 1500,
    address: "2 Riverside Close",
    location: "Woodbridge",
    beds: 4,
    baths: 2,
    propertyType: "House",
    description:
      "An elevated home with a calm setting, generous bedrooms, and a refined finish throughout.",
    images: ["Gallery 1", "Gallery 2", "Gallery 3"],
  },
  {
    id: "p-1005",
    price: 850,
    address: "71 Market Square",
    location: "Ipswich",
    beds: 2,
    baths: 2,
    propertyType: "Flat",
    description:
      "A stylish apartment featuring two bathrooms, contemporary styling, and a convenient location.",
    images: ["Gallery 1", "Gallery 2", "Gallery 3"],
  },
  {
    id: "p-1006",
    price: 720,
    address: "19 Garden Walk",
    location: "Stowmarket",
    beds: 1,
    baths: 1,
    propertyType: "Other",
    description:
      "A serene, practical property with easy access to transport and local shopping.",
    images: ["Gallery 1", "Gallery 2", "Gallery 3"],
  },
  {
    id: "p-1007",
    price: 1100,
    address: "5 Kingsway",
    location: "Ipswich",
    beds: 3,
    baths: 1,
    propertyType: "House",
    description:
      "A welcoming home with a functional layout, suitable for professional tenants.",
    images: ["Gallery 1", "Gallery 2", "Gallery 3"],
  },
  {
    id: "p-1008",
    price: 780,
    address: "27 High Street",
    location: "Woodbridge",
    beds: 2,
    baths: 1,
    propertyType: "Flat",
    description:
      "A comfortable flat with a clean interior, ideal for those seeking a central base.",
    images: ["Gallery 1", "Gallery 2", "Gallery 3"],
  },
];

