import Treefinder from "./treefinder";
import { getChatGPTUser } from "./chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getChatGPTUser();
  return (
    <Treefinder
      user={
        user
          ? {
              id: user.userId,
              name: user.fullName ?? user.email,
              email: user.email,
            }
          : null
      }
    />
  );
}
