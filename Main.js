import * as KadUtils from "./Data/KadUtils.js";
import { read, utils } from "https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs";
let selectedFile;

window.onload = mainSetup;

function mainSetup() {
	console.log("hello");
	KadUtils.daEL(idVin_excelInput, "change", (evt) => getExcel(evt));
}

// document.getElementById("fileUpload").addEventListener("change", function (event) {
// 	selectedFile = event.target.files[0];
// });
const filterFamily = ["Rohteil", "Baugruppe"];

function getExcel(evt) {
	selectedFile = evt.target.files[0];
	console.log(selectedFile);
	console.log("start");
	let fileReader = new FileReader();
	fileReader.onload = (event) => {
		let data = event.target.result;
		parseExcelSheet(data);
	};
	fileReader.readAsBinaryString(selectedFile);
}

function parseExcelSheet(data) {
	let workbook = read(data, { type: "binary" });
	workbook.SheetNames.forEach((sheet) => {
		let dataArray = utils.sheet_to_row_object_array(workbook.Sheets[sheet]);
		const filtered = dataArray.filter((obj) => !filterFamily.includes(obj.Teilefamilie));
		let list = {};
		for (let obj of filtered) {
			let mm = obj.MM.toString().padStart(6, "0");
			if (list[mm] === undefined) {
				list[mm] = { mm: obj };
				list[mm].Anzahl = Number(obj.Anzahl);
			} else {
				list[mm].Anzahl += Number(obj.Anzahl);
			}
		}

		console.log(filtered);
		console.log(list);

		// let stringedObject = JSON.stringify(dataArray);
		// KadUtils.dbID("idLbl_Output").innerHTML = stringedObject;
	});
}
