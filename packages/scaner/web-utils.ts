import { getBody, WebPageScaner } from "./web"


const scaner = new WebPageScaner()

const body = getBody()

export type WebPageScanerOptions = {
    selector: string
}

export const getBodyElement = async (
    url: string, waitSelector: string ) => {
    const html = await scaner.read(
            url, waitSelector
    )
    body.innerHTML = html
    return body
}