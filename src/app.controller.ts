import { Controller, Post, UploadedFile, UseInterceptors, Res, Get, Body } from '@nestjs/common';
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
    return('hello world');
  }

  
  @Post('generate-report')
  async generateReport(@Body('totalEfectivo') totalEfectivo: number, @Res() res: Response) {
    try {
      const pdfPath = path.join(__dirname, '..', 'uploads', 'report.pdf');
      const doc = new PDFDocument({
        size: [198, 280],
        margin: 10
      });

      const formattedTotalEfectivo = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
      }).format(totalEfectivo);

      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);

      const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
      const logoWidth = 150;  // Ancho del logo
      // const logoHeight = 50; // Alto del logo
      doc.image(logoPath, (doc.page.width - logoWidth) / 2, 10, { width: logoWidth });
      
      doc.font('Helvetica-Bold');
      
      // Título
      doc.moveDown(4);
      doc.fontSize(12).text('Cierre de caja', { align: 'center'});

      // Datos del reporte
      doc.moveDown(1);
      doc.fontSize(10).text(`Fecha: ${new Date().toLocaleString()}`, { align: 'center'});
      doc.moveDown(2);
      doc.fontSize(11.5).text('Tot. efectivo:', {continued:true}).text(`${formattedTotalEfectivo} `, { align: 'right'})
      
      // Firma y aclaración
      doc.moveDown(2);

      doc.font('Helvetica').fontSize(11);
      doc.text('.......................................................', { align: 'center'});
      doc.text('Firma:', {align: 'center'});
      doc.moveDown(2);
      doc.text('.......................................................', { align: 'center'});
      doc.text('Aclaración:', { align: 'center'});

      // Terminar el documento
      doc.end();

      writeStream.on('finish', () => {
        res.sendFile(pdfPath, err => {
          if (err) {
            console.error('Error sending PDF:', err);
            res.status(500).send('Error generating PDF');
          } else {
            fs.unlinkSync(pdfPath); // Eliminar el archivo PDF después de enviarlo
          }
        });
      });

    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).send('Error generating PDF');
    }
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Res() res: Response) {
    try {
      // Leer el archivo XLSX
      const workbook = XLSX.readFile(file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      function createPDF(ticketData) {
        const pdfPath = path.join(__dirname, '..', 'uploads', 'transformed.pdf');
        const doc = new PDFDocument({
          size: [198, 841],
          margin: 0
        });
        const writeStream = fs.createWriteStream(pdfPath);
        doc.pipe(writeStream);

        doc.font('Courier-Bold');
        doc.fontSize(9); // Tamaño de fuente reducido para impresora POS

        const drawBorders = (x, y, width, height) => {
          doc.rect(x, y, width, height).stroke();
        };

        const addDataToPDF = (ticketData) => {
          const rowHeight = 15;
          const colWidths = [98, 50, 50]; // Anchos de las columnas
          const pageHeight = 841;
          let xPos = 0;
          let yPos = 0;
          for (let i = 0; i < ticketData.length; i++) {
            if (yPos + rowHeight > pageHeight) {
              doc.addPage({ size: [198, pageHeight], margin: 0 }); // Crear nueva página
              yPos = 0; // Reiniciar la posición y para la nueva página
            }

            xPos = 0; // Reiniciar la posición x para cada fila
            for (let j = 0; j < ticketData[i].length; j++) {
              const text = ticketData[i][j] ? ticketData[i][j].toString() : '';
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

        addDataToPDF(ticketData);

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
