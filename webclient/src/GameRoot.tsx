import { useEffect, useState } from "react";
import App from "./App";
import RoomHub from "./components/RoomHub";
import HomePage from "./components/HomePage";
import ProfilePage from "./components/ProfilePage";

export default function GameRoot() {
  const [route, setRoute] = useState(() => window.location.hash);
  useEffect(() => {
    const changed = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const navigate = (destination: string) => {
    history.pushState(null, "", destination ? `#${destination}` : `${window.location.pathname}${window.location.search}`);
    setRoute(destination ? `#${destination}` : "");
  };
  if (import.meta.env.MODE === "pages") {
    if (route === "#solo") return <App onHome={() => navigate("")} />;
    return <HomePage singlePlayerOnly onPlaySolo={() => navigate("solo")} onOpenRooms={() => {}}
      onOpenRoom={() => {}} onOpenProfile={() => {}} onHome={() => navigate("")} />;
  }
  if (route === "#rooms" || route.startsWith("#room=")) {
    return <RoomHub key={route} onBack={() => navigate("")} />;
  }
  if (route === "#solo") {
    return <App onOpenRooms={() => navigate("rooms")} onHome={() => navigate("")} />;
  }
  if (route === "#profile") return <ProfilePage onBack={() => navigate("")} />;
  return <HomePage onPlaySolo={() => navigate("solo")} onOpenRooms={() => navigate("rooms")}
    onOpenRoom={roomId => navigate(`room=${roomId}`)} onOpenProfile={() => navigate("profile")} onHome={() => navigate("")} />;
}
