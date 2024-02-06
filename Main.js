import * as KadUtils from "./Data/KadUtils.js";
import { utils, read, writeFile } from "https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs";

window.onload = mainSetup;

function mainSetup() {
	console.log("hello");
	KadUtils.daEL(idVin_excelInput, "change", (evt) => getExcel(evt));
}

const mmID = "MM";
const count = "Anzahl";
const partFamily = "Teilefamilie";
const filterFamily = ["Rohteil", "Baugruppe"];

function getExcel(evt) {
	let selectedFile = evt.target.files[0];
	console.log(selectedFile);
	let fileReader = new FileReader();
	fileReader.onload = (event) => {
		let data = event.target.result;
		parseExcelSheet(data);
	};
	fileReader.readAsBinaryString(selectedFile);
}

function parseExcelSheet(data) {
	let header = [];
	let workbook = read(data, { type: "binary" });
	workbook.SheetNames.forEach((sheet) => {
		let dataArray = utils.sheet_to_row_object_array(workbook.Sheets[sheet]);
		header = Object.keys(dataArray[0]);
		console.log(header);
		const filtered = dataArray.filter((obj) => !filterFamily.includes(obj[partFamily]));
		let objectList = {};
		for (let obj of filtered) {
			let id = obj[mmID].toString().padStart(6, "0");
			if (objectList[id] === undefined) {
				objectList[id] = obj;
			} else {
				objectList[id][count] += obj[count];
			}
		}

		console.log(objectList);
		let wbArray = [];

		for (let [index, listItem] of Object.values(objectList).entries()) {
			wbArray[index] = [];
			for (let item of Object.values(listItem)) {
				wbArray[index].push(item);
			}
		}
		wbArray.unshift(header);
		console.log(wbArray);

		let wb = utils.book_new();
		let ws = utils.aoa_to_sheet(wbArray);
		utils.book_append_sheet(wb, ws, "Sheet1");
		// writeFile(wb, "outFile.xlsx", { compression: true });
		writeFile(wb, "Stücklistenvergleich.xlsx");
	});
}
