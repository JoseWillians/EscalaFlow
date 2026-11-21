import { toPng } from 'html-to-image';

export async function exportElementToPngDataUrl(element: HTMLElement): Promise<string> {
  return toPng(element, {
    pixelRatio: 2,
    backgroundColor: '#FFFFFF',
    cacheBust: true,
  });
}

export async function downloadElementAsPng(
  element: HTMLElement,
  filename: string,
): Promise<string> {
  const dataUrl = await exportElementToPngDataUrl(element);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return dataUrl;
}
