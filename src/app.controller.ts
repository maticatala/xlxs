import { Controller, Post, UploadedFile, UseInterceptors, Res, Get, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AppService } from './app.service';
import * as https from 'https';
import { json } from 'stream/consumers';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('generate-report')
  async generateReport(@Body('totalEfectivo') totalEfectivo: number, @Res() res: Response) {
    try {
      this.appService.generateReport(totalEfectivo, res);
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).send('Error generating PDF');
    }
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Res() res: Response) {
    try {
      this.appService.uploadFile(file, res);
    } catch (error) {
      console.error('Error processing file:', error);
      res.status(500).send('Error processing file');
    }
  }
}
