import * as KadUtils from "./Data/KadUtils.js";
import { utils, read, writeFile } from "https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs";

window.onload = mainSetup;

function mainSetup() {
	KadUtils.KadDOM.resetInput(idVin_customerNumber, "Beistellnummer", { min: 0, max: 999999 });
	KadUtils.daEL(idVin_customerNumber, "input", getCustomerNumber);
	dashZeroState = KadUtils.KadDOM.resetInput(idCB_dashZero, false);
	KadUtils.daEL(idCB_dashZero, "change", dashZeroFilter);

	KadUtils.dbID(idLbl_loadedSOU).textContent = "nicht geladen";
	KadUtils.dbID(idLbl_loadedCAD).textContent = "nicht geladen";
	KadUtils.dbID(idLbl_compare).textContent = "Daten hochladen";

	KadUtils.daEL(idVin_inputSOU, "change", (evt) => getFile(evt, "SOU"));
	KadUtils.daEL(idVin_inputCAD, "change", (evt) => getFile(evt, "TEXT"));
	KadUtils.daEL(idBtn_compare, "click", startCompare);
	KadUtils.KadDOM.enableBtn(idBtn_compare, false);
}

const mmID = "ArtikelNr";
const count = "Menge";
const name = "Bezeichnung";
const partFamily = "ArtikelTeileFamilie";
const filterFamily = ["Rohmaterial", "Baugruppe"];
const parsedHeader = [mmID, "SOU", "CAD", name, partFamily];

let customerNumber = "";
let dashZeroState = false;
let filedataSOU = null;
let filedataCAD = null;
let objectListSOU = {};
let objectListCAD = {};
let objectListCompared = {};
let objectListDifferences = {};
let filesParsed = {
	SOU: false,
	CAD: false,
};

function getCustomerNumber(event) {
	customerNumber = event.target.valueAsNumber;
}

function dashZeroFilter(event) {
	dashZeroState = event.target.checked;
}

function getFile(evt, type) {
	let selectedFile = evt.target.files[0];
	let fileReader = new FileReader();
	if (type == "SOU") {
		fileReader.onload = (event) => {
			filedataSOU = event.target.result;
			parseFileExcel();
		};
		fileReader.readAsBinaryString(selectedFile);
	}
	if (type == "TEXT") {
		fileReader.onload = (event) => {
			filedataCAD = event.target.result.split(/\r?\n/);
			parseFileText();
		};
		fileReader.readAsText(selectedFile);
	}
}

function fileIsLoaded(type) {
	filesParsed[type] = true;

	const count = type == "SOU" ? objLength(objectListSOU) : objLength(objectListCAD);
	KadUtils.dbID(`idLbl_loaded${type}`).textContent = `${count} Teile geladen`;
	if (filesParsed.SOU && filesParsed.CAD) KadUtils.KadDOM.enableBtn(idBtn_compare, true);
}

function parseFileExcel() {
	let workbook = read(filedataSOU, { type: "binary" });
	workbook.SheetNames.forEach((sheet) => {
		objectListSOU = {};
		let dataArray = utils.sheet_to_row_object_array(workbook.Sheets[sheet]);
		const filtered = dataArray.filter((obj) => !filterFamily.includes(obj[partFamily]));
		for (let obj of filtered) {
			if (obj[mmID]) {
				let id = obj[mmID].toString().padStart(6, "0");
				if (objectListSOU[id] === undefined) {
					objectListSOU[id] = obj; // objectListSOU[id][mmID] = id; // format as String with leading 0
				} else {
					objectListSOU[id][count] += obj[count];
				}
			}
		}
		fileIsLoaded("SOU");
	});
}

function parseFileText() {
	objectListCAD = {};
	for (let row of filedataCAD) {
		if (row.trim() == "") continue;
		// const depth = row.search(/\S|$/) / 3;
		let text = row.trim();
		if (text.trim().substring(0, 3) === "|--") text = text.trimStart().slice(3); // remove "|--"

		if (cleanParentheses(text)) continue; // igrnore drawings

		const id = Number(text.slice(0, 6)); // get MM-Nummer
		if (Number.isNaN(id)) continue; // ignore MM-Nummer is NaN

		if (id == customerNumber) continue;
		if (id % 10 == 0 && filterFamily.includes("Baugruppe")) continue; //  ignore filter "Baugruppe"

		text = text.replace(/^\d{6}/, ""); // remove MM-Nummer

		if (dashZeroState && text.trim().substring(0, 2) === "-0") continue; //  ignore filter "-0"

		text = text.split("[")[0].trim(); // remove trailing [xx]

		const obj = {
			[mmID]: id,
			[count]: 1,
			[name]: text,
		};
		if (objectListCAD[id] === undefined) {
			objectListCAD[id] = obj;
		} else {
			objectListCAD[id][count]++;
		}
	}
	fileIsLoaded("CAD");
}

function cleanParentheses(text) {
	if (text.match(/\[\]/)) return true; //cleanDrawings
	if (text.match(/\(\d{0,}\)/)) return true; //cleanDrawings
	return false;
}

function startCompare() {
	if (objLength(objectListCompared) > 0) {
		parseFileExcel();
		parseFileText();
	}

	objectListCompared = {};
	for (let [souKey, souValue] of Object.entries(objectListSOU)) {
		const cadCount = objectListCAD[souKey] == null ? 0 : objectListCAD[souKey][count];
		objectListCompared[souKey] = {
			[mmID]: souValue[mmID],
			SOU: souValue[count],
			CAD: cadCount,
			[name]: souValue[name],
			[partFamily]: souValue[partFamily],
		};
	}

	for (let [cadKey, cadValue] of Object.entries(objectListCAD)) {
		if (objectListCompared[cadKey] === undefined) {
			const souCount = objectListSOU[cadKey] == null ? 0 : objectListSOU[cadKey][count];
			const souPart = objectListSOU[cadKey] == null ? "" : objectListSOU[cadKey][partFamily];
			objectListCompared[cadKey] = {
				[mmID]: cadValue[mmID],
				SOU: souCount,
				CAD: cadValue[count],
				[name]: cadValue[name],
				[partFamily]: souPart,
			};
		}
	}

	objectListDifferences = Object.values(objectListCompared).filter((obj) => obj.SOU != obj.CAD);
	createFile();
}

function createFile() {
	let dataDiff = [];
	let dataComp = [];

	for (let [index, listItem] of Object.values(objectListDifferences).entries()) {
		dataDiff[index] = [];
		for (let h of parsedHeader) {
			dataDiff[index].push(listItem[h]);
		}
	}

	for (let [index, listItem] of Object.values(objectListCompared).entries()) {
		dataComp[index] = [];
		for (let h of parsedHeader) {
			dataComp[index].push(listItem[h]);
		}
  }

	KadUtils.dbID(idLbl_compare).textContent = `${dataDiff.length} Fehler gefunden!`;

	dataDiff.sort((a, b) => a[0] - b[0]);
	dataComp.sort((a, b) => a[0] - b[0]);

	dataDiff.unshift(parsedHeader);
	dataComp.unshift(parsedHeader);
	const book = utils.book_new();
	let sheetDiff = utils.aoa_to_sheet(dataDiff);
	let sheetComp = utils.aoa_to_sheet(dataComp);
	utils.book_append_sheet(book, sheetDiff, "Differenz");
	utils.book_append_sheet(book, sheetComp, "Alles");
	writeFile(book, "Stücklistenvergleich.xlsx");
}

function objLength(obj) {
	return Object.keys(obj).length;
}
