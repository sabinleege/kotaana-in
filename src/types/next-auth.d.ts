import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "athlete" | "coach" | "admin";
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    role: "athlete" | "coach" | "admin";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "athlete" | "coach" | "admin";
  }
}
