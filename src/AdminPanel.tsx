import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { DeviceDto } from "./models/device";
import { DeviceState } from "./models/socket.dto";

const apiUrl = "https://nestjs-socket.onrender.com";
// const apiUrl = "http://localhost:3001";

export default function AdminPanel() {
  const socket = io(apiUrl);
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [powerEvent, setPowerEvent] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceDto | null>(null);
  const [startingView, setStartingView] = useState<boolean>(false);

  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const [peerConnection, setPeerConnection] = useState(new RTCPeerConnection());

  useEffect(() => {
    (async () => {
      const deviceData: DeviceDto[] = await fetch(`${apiUrl}/devices/list`).then(
        (response) => response.json(),
      );

      setDevices(deviceData);

      socket.on("computers", (data: DeviceDto[]) => {
        setDevices(data);
      });

      socket.on("update-computers", (data: DeviceDto[]) => setDevices(data));
    })();

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

  useEffect(() => {
    socket.on("change-state", (data: DeviceState) => {
      setDevices((prev) => {
        const updatedDevices = [...prev];

        const deviceIndex = updatedDevices.findIndex((dv) => dv.deviceId === data.id);

        if (deviceIndex !== -1) {
          updatedDevices[deviceIndex] = {
            ...updatedDevices[deviceIndex],
            shutdown: data.shutdown,
            isEnable: data.isEnable,
            isLock: data.isLock,
          };
        }

        if ((data.isLock || !data.shutdown) && selectedDevice?.deviceId === data.id) {
          setPowerEvent(
            data.shutdown ? "The computer is shutting down..." : "The computer is locked.",
          );
        } else {
          setPowerEvent(null);
        }

        console.log({ updatedDevices });
        return updatedDevices;
      });
    });

    return () => {
      socket.off("change-state");
    };
  }, [devices]);

  const startWatching = () => {
    if (selectedDevice) {
      setStartingView(true);
      setPeerConnection(new RTCPeerConnection());
      socket.emit(`start-stream`, selectedDevice.deviceId);
    }
  };

  const stopWatching = () => {
    if (selectedDevice) {
      if (screenVideoRef.current?.srcObject instanceof MediaStream) {
        screenVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
        screenVideoRef.current.srcObject = null;
      }

      if (cameraVideoRef.current?.srcObject instanceof MediaStream) {
        cameraVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
        cameraVideoRef.current.srcObject = null;
      }
      setPowerEvent(null);
      setStartingView(false);
      socket.emit(`stop-stream`, selectedDevice.deviceId);
    }
  };

  return (
    <div className="container">
      <div className="device-list">
        <h2>List of devices</h2>
        <ul>
          {devices.map((device) => (
            <li
              key={device.deviceId}
              onClick={() => !screenVideoRef?.current?.srcObject && setSelectedDevice(device)}
            >
              <div className="device-info">
                <div className="device-info-detail">
                  <label>ID:</label>
                  <span>{device.deviceId}</span>
                </div>
                <div className="device-info-detail">
                  <label>Device Name:</label>
                  <span>{device.name}</span>
                </div>
                <div className="device-info-detail">
                  <label>Status:</label>
                  <span
                    title={
                      !device.shutdown
                        ? "The computer is ready for monitoring"
                        : "The computer is shut down"
                    }
                    className={`dot ${!device.shutdown ? "success" : "danger"}-bg`}
                  ></span>

                  <label>Is Enable:</label>
                  <span
                    title={
                      !device.isEnable && !device.shutdown
                        ? "Being monitored by someone else"
                        : "The computer is ready for monitoring"
                    }
                    className={`dot ${(device.isEnable && !device.shutdown) ? "success" : "danger"}-bg`}
                  ></span>

                  <label>Is Lock:</label>
                  <span
                    title={
                      device.isLock
                        ? "The computer is locked"
                        : "The computer is ready for monitoring"
                    }
                    className={`dot ${device.isLock ? "danger" : "success"}-bg`}
                  ></span>
                </div>
              </div>
              {selectedDevice && selectedDevice.deviceId === device.deviceId && (
                <div className="controls">
                  <button onClick={startWatching} disabled={device.shutdown || !device.isEnable || startingView}>
                    Start Watching
                  </button>
                  <button className="stop" disabled={!startingView} onClick={stopWatching}>
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

        <video ref={screenVideoRef} autoPlay playsInline className={powerEvent ? "blurred" : ""} />

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
