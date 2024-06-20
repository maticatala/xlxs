import { Controller, Post, UploadedFile, UseInterceptors, Res, Get } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as XLSX from 'xlsx';
import * as PDFDocument from 'pdfkit';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller()
export class AppController {

  @Get()
  async test() {
    return('hello world')
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Res() res: Response) {
    try {
      // Leer el archivo XLSX
      const workbook = XLSX.readFile(file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      function calculateTicketHeight(ticketData) {
        const lineHeight = 15;
        return (ticketData.length * lineHeight);
      }

      function createPDF(ticketData) {
        const ticketHeight = calculateTicketHeight(ticketData);
        const pdfPath = path.join(__dirname, '..', 'uploads', 'transformed.pdf');
        const doc = new PDFDocument({
          size: [198, ticketHeight],
          margin: 0
        });
        const writeStream = fs.createWriteStream(pdfPath);
        doc.pipe(writeStream);

        doc.pipe(fs.createWriteStream('ticket.pdf'));
        doc.font('Courier-Bold');
        doc.fontSize(9); // Tamaño de fuente reducido para impresora POS

        const drawBorders = (x, y, width, height) => {
          doc.rect(x, y, width, height).stroke();
        };  

        const addDataToPDF = () => {
          const rowHeight = 15;
          const colWidths = [98, 50, 50]; // Anchos de las columnas
          let xPos = 0;
          let yPos = 0;
          for (let i = 0; i < filteredData.length; i++) {
            xPos = 0; // Reiniciar la posición x para cada fila
  
            for (let j = 0; j < filteredData[i].length; j++) {
              const text = filteredData[i][j] ? filteredData[i][j].toString() : '';
              const options = {
                width: colWidths[j] - 10,
                align: j === 1 && i >= 1 ? 'center' : 'left', // Centrar los datos de la columna A2 desde la fila 2
              };
  
              doc.text(text, xPos + 5, yPos + 5, options);
              drawBorders(xPos, yPos, colWidths[j], rowHeight);
  
              xPos += colWidths[j]; // Mover la posición x para la siguiente columna
            }
  
            yPos += rowHeight; // Mover la posición y para la siguiente fila
          }
        };
  
        addDataToPDF();

        // Terminar el documento
        doc.end();


        writeStream.on('finish', () => {
          // Enviar el PDF al cliente
          res.sendFile(pdfPath, err => {
            if (err) {
              console.error('Error sending PDF:', err);
              res.status(500).send('Error generating PDF');
            } else {
              fs.unlinkSync(file.path); // Eliminar el archivo XLSX original
              fs.unlinkSync(pdfPath); // Eliminar el archivo PDF después de enviarlo
            }
          });
        });
      }

      // Leer los datos del archivo
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Procesar la columna A1
      for (let i = 0; i < data.length; i++) {
        if (typeof data[i][0] === 'string') {
          const match = data[i][0].match(/\[(.*?)\]/);
          data[i][0] = match ? match[1] : '';
        }
      }

      // Filtrar datos de las columnas A y B desde la fila 5
      const filteredData = data.slice(4).map(row => [row[0], row[1], '']);

      // Agregar encabezados
      filteredData.unshift(['CÓDIGO', 'SISTEMA', 'LOCAL']);

      createPDF(filteredData);


    } catch (error) {
      console.error('Error processing file:', error);
      res.status(500).send('Error processing file');
    }
  }
}
