import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function AdminPanel() {
  const socket = io("https://nestjs-socket.onrender.com");
  const [computers, setComputers] = useState<string[]>([]);
  const [powerEvent, setPowerEvent] = useState<string | null>(null);
  const [selectedComputer, setSelectedComputer] = useState<string | null>(null);

  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const [peerConnection] = useState(new RTCPeerConnection());

  useEffect(() => {
    socket.on("computers", (data: string[]) => {
      setComputers(data);
    });

    socket.on("update-computers", (data: string[]) => setComputers(data));

    socket.on("computer-state", (data: Record<string, boolean | undefined>) => {
      if (!!data.lockScreen || !!data.shutdown) {
        setPowerEvent(
          !!data.shutdown ? "The computer is shutting down..." : "The computer is locked.",
        );
      } else {
        setPowerEvent(null);
      }
    });

    socket.on("video-stopped", () => {
      // if (videoRef.current) {
      //   videoRef.current.srcObject = null;
      // }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (event.track.kind === "video") {
        if (!screenVideoRef.current?.srcObject) {
          screenVideoRef.current!.srcObject = stream;
        } else {
          cameraVideoRef.current!.srcObject = stream;
        }
      }
    };

    socket.on("offer", async (offer) => {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit("answer", answer);
    });

    socket.on("ice-candidate", async (candidate) => {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => {
      peerConnection.close();
    };
  }, [peerConnection]);

  const startWatching = () => {
    if (selectedComputer) {
      socket.emit("start-stream", selectedComputer);
    }
  };

  const stopWatching = () => {
    if (selectedComputer) {
      screenVideoRef.current!.srcObject = null;
      cameraVideoRef.current!.srcObject = null;
      setPowerEvent(null);
      socket.emit("stop-stream", selectedComputer);
    }
  };

  return (
    <div className="container">
      <div className="device-list">
        <h2>List of devices</h2>
        <ul>
          {computers.map((computerId) => (
            <li
              key={computerId}
              onClick={() => !screenVideoRef?.current?.srcObject && setSelectedComputer(computerId)}
            >
              <span>{computerId}</span>

              {selectedComputer && selectedComputer === computerId && (
                <div className="controls">
                  <button onClick={startWatching}>Start Watching</button>
                  <button className="stop" onClick={stopWatching}>
                    Stop Watching
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="video-player">
        {powerEvent && <PowerNotification message={powerEvent} />}

        <video
          ref={screenVideoRef}
          autoPlay
          playsInline
          className={powerEvent ? "blurred" : ""}
        />

        <video ref={cameraVideoRef} autoPlay playsInline className="camera-feed" />
      </div>
    </div>
  );
}

const PowerNotification = ({ message }: { message: string }) => {
  return (
    <div className="power-notification">
      <div className="icon">⚠️</div>
      <div className="content">
        <strong>System Alert</strong>
        <p>{message}</p>
      </div>
    </div>
  );
};
