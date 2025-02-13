import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import * as fs from 'fs';
import * as path from 'path';
import { Server, Socket } from 'socket.io';
import { DeviceService } from './device.service';
import { DeviceDto } from '../models/device.dto';
import { DeviceState, VideoBlobData } from '../models/socket.dto';
import { StreamDto } from '../models/stream.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class SocketGateway {
  @WebSocketServer()
  server: Server;

  private writeCamera: StreamDto = {
    stream: undefined,
    filePath: '',
    deviceId: '',
    startTime: 0,
  };
  private writeDesktop: StreamDto = {
    stream: undefined,
    filePath: '',
    deviceId: '',
    startTime: 0,
  };

  constructor(private deviceService: DeviceService) {}

  @SubscribeMessage('register-computer')
  async handleRegister(
    @MessageBody() device: DeviceDto,
    @ConnectedSocket() client: Socket,
  ) {
    await this.deviceService.setDevice(device);
    this.server.emit('update-computers', await this.deviceService.getDevices());
    await client.join(device.deviceId);
  }

  @SubscribeMessage('start-stream')
  handleStartStream(@MessageBody() id: string) {
    this.server.emit(`start-stream-${id}`);
  }

  @SubscribeMessage('stop-stream')
  async handleStopStream(@MessageBody() id: string) {
    this.writeCamera.stream?.end();
    this.writeDesktop.stream?.end();
    const endTime = new Date().getTime();

    await this.deviceService.setDeviceVideo({
      deviceId: this.writeDesktop.deviceId,
      videoPath: this.writeDesktop.filePath,
      videoTime: endTime - this.writeDesktop.startTime,
    });

    await this.deviceService.setDeviceVideo({
      deviceId: this.writeCamera.deviceId,
      videoPath: this.writeCamera.filePath,
      videoTime: endTime - this.writeCamera.startTime,
    });

    this.writeCamera = {
      stream: undefined,
      filePath: '',
      deviceId: '',
      startTime: 0,
    };
    this.writeDesktop = {
      stream: undefined,
      filePath: '',
      deviceId: '',
      startTime: 0,
    };
    this.server.emit(`stop-stream-${id}`);
  }

  @SubscribeMessage('stream-blob-data')
  handleStreamBlobData(@MessageBody() data: VideoBlobData) {
    if (data.folder === 'desktop') {
      this.writeDesktop.startTime = data.startTime;
      this.writeDesktop.deviceId = data.deviceId;
      this.writeDesktop.filePath = path.join(
        __dirname,
        `../src/uploads/${data.folder}`,
        `${data.deviceId}.webm`,
      );
      if (!this.writeDesktop.stream) {
        this.writeDesktop.stream = fs.createWriteStream(
          this.writeDesktop.filePath,
          {
            flags: 'a',
          },
        );
      }

      this.writeDesktop.stream.write(Buffer.from(data.blob));
    } else {
      this.writeCamera.startTime = data.startTime;
      this.writeCamera.deviceId = data.deviceId;
      this.writeCamera.filePath = path.join(
        __dirname,
        `../src/uploads/${data.folder}`,
        `${data.deviceId}.webm`,
      );
      if (!this.writeCamera.stream) {
        this.writeCamera.stream = fs.createWriteStream(
          this.writeCamera.filePath,
          { flags: 'a' },
        );
      }

      this.writeCamera.stream.write(Buffer.from(data.blob));
    }
  }

  @SubscribeMessage('change-state')
  async handleChangeState(@MessageBody() data: DeviceState) {
    await this.deviceService.changeDeviceState(data);
    this.server.emit(`change-state`, data);
  }

  @SubscribeMessage('offer')
  handleOffer(
    @MessageBody() offer: any,
    @ConnectedSocket() client: Socket,
  ): void {
    client.broadcast.emit('offer', offer);
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @MessageBody() answer: any,
    @ConnectedSocket() client: Socket,
  ): void {
    client.broadcast.emit('answer', answer);
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @MessageBody() candidate: any,
    @ConnectedSocket() client: Socket,
  ): void {
    client.broadcast.emit('ice-candidate', candidate);
  }
}
