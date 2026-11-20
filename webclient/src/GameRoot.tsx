import { useEffect, useState } from "react";
import App from "./App";
import RoomHub from "./components/RoomHub";
import HomePage from "./components/HomePage";
import SoloLobby from "./components/SoloLobby";
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
  const singlePlayerOnly = import.meta.env.MODE === "pages";
  const openSoloLobby = () => navigate("solo");
  if (route === "#solo") {
    return <SoloLobby onHome={() => navigate("")} onNew={() => navigate("solo=new")}
      onOpen={id => navigate(`solo=${encodeURIComponent(id)}`)} />;
  }
  if (route.startsWith("#solo=")) {
    const id = route.slice(6);
    return <App key={route} onHome={openSoloLobby} onOpenRooms={singlePlayerOnly ? undefined : () => navigate("rooms")}
      soloGame={{ id: id === "new" ? null : id, onSession: (sessionId, previous) => {
        if (window.location.hash === `#solo=${previous ?? "new"}`) {
          history.replaceState(null, "", `#solo=${encodeURIComponent(sessionId)}`);
        }
      } }} />;
  }
  if (!singlePlayerOnly && route === "#solo-legacy") return <App legacySolo onHome={openSoloLobby} />;
  if (!singlePlayerOnly && (route === "#rooms" || route.startsWith("#room="))) {
    return <RoomHub key={route} onBack={() => navigate("")} />;
  }
  if (!singlePlayerOnly && route === "#profile") return <ProfilePage onBack={() => navigate("")} />;
  return <HomePage singlePlayerOnly={singlePlayerOnly} onPlaySolo={openSoloLobby} onOpenRooms={() => navigate("rooms")}
    onOpenProfile={() => navigate("profile")} onHome={() => navigate("")} />;
}
