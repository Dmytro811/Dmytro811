declare module 'qr-code-styling' {
  export default class QRCodeStyling {
    constructor(options: any);
    append(element: HTMLElement): void;
    update(options: any): void;
    download(options?: any): void;
  }
}

