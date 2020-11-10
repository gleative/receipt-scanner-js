import React from 'react';
import styled from 'styled-components';
import { createWorker } from 'tesseract.js';
import './App.css';
import kommersnart from './assets/kommersnart.png';
import IMG_2034 from './assets/receiptImages/IMG_2034.png';
import IMG_2035 from './assets/receiptImages/IMG_2035.jpg';
import remaKvitto from './assets/receiptImages/rema_kvitto.png';
import coop6ItemsFlash from './assets/receiptImages/coop6ItemsFlash.jpg';
import coop3ItemsFlash from './assets/receiptImages/coop3ItemsFlash.jpg';
import * as groceryStore from './assets/consts/groceryStores';
import * as GroceryUtil from './model/Grocery';

// TODO: DER JEG SLAPP SIST! Får ut prisen NÅ! Nå må jeg få tak i navn! (createGroceryObject) klarer nå å få ut pris.. bruk samme match for å fjerne "pris" stringen i hver rad?
// ! Husk du kan kjøre uten scan med å kommentere ut og inn

/*
  TODO FOR WHOLE APP:
  - Knapp som lager request på vipps
  - Liste over varene
  - Checkboxes, for å selecte hvilken varer
  - Velge antall mennesker det skal splittes på
  - Hvis sum av vare
  - Gjør slik at kamera bruker flash! Større sjanse for bedre scan
  - Lag regex js fil, hvor du har alle regex....



*/

function App() {
  // ? Image we will scan... TAKE FLASH PICTURE, reads better!
  const img = coop6ItemsFlash;

  const worker = createWorker({
    logger: (m) => {
      console.log(m);

      // ? When status is this, we know it is ready and is scanning the photo
      if (m.status === 'recognizing text') {
        setScanProgress(m.progress);
      }
    },
  });

  // TODO: Kan velge språk kvittering er i.. utifra hva bruker velger, så setter vi language! Kan legge til flere languages: syntax: 'nor+eng'
  // rii
  const readNorwegianOCR = async () => {
    setIsScanning(true);
    setOcr('Recognizing...');

    await worker.load();
    await worker.loadLanguage('nor');
    await worker.initialize('nor');
    // await worker.setParameters({
    //   tessedit_char_whiltelist: '-',
    // });

    const {
      data: { text },
    } = await worker.recognize(img);

    const splitText = text.split('\n');

    setOcr(text);
    console.log(text);
    console.log('TEXT: ', splitText);
    setOcrSplit([...splitText]);

    setIsScanning(false);

    await worker.terminate();
  };

  const getStore = () => {
    console.log('OCR value: ', ocr);

    const splitText = ocr.split('\n');
    console.log('splitText: ', splitText);
    // console.log('OCR SPLIT: ', ocrSplit); // Tar litt tid før du ser state er updated! Er derfor den kan være tom hvis du clg med engang

    splitText.forEach((text) => {
      if (text.toLowerCase().includes('meny')) {
        setStoreName(groceryStore.MENY);
        return;
      }

      if (text.toLowerCase().includes('mega')) {
        setStoreName(groceryStore.COOP_MEGA);
        return;
      }

      // TODO: Rema - IN PROGRESS, Problem med å få ut pris for hver vare (checkIfDiscountText)
      if (text.toLowerCase().includes('rema')) {
        setStoreName(groceryStore.REMA_1000);
        return;
      }

      // TODO: Kiwi
      if (text.toLowerCase().includes('kiwi')) {
        setStoreName(groceryStore.KIWI);
        return;
      }
    });
  };

  function getGroceries() {
    console.log('getGroceries ----------------------------');
    console.log('getGroceries OCR SPLIT: ', ocrSplit);
    console.log('storeName: ', storeName);

    let i,
      startIndex,
      endIndex = 0;

    for (i = 0; i < ocrSplit.length; i++) {
      let currentVal = ocrSplit[i];

      if (storeName === groceryStore.COOP_MEGA) {
        if (
          currentVal.toLowerCase().includes('salgskvittering') ||
          currentVal.toLowerCase().includes('salaskvittering')
        ) {
          console.log('salgs kvittering reached at index: ', i);
          startIndex = i;
        }

        if (currentVal.toLowerCase().includes('totalt')) {
          console.log('totalt reached at index: ', i);

          // We minus, so splice function cuts correctly (i vil alltid være større tall enn startIndex, så no stress å substrahere)
          endIndex = i - startIndex;

          // We got what we want, exit the loop
          break;
        }
      } else if (storeName === groceryStore.REMA_1000) {
        if (currentVal.toLowerCase().includes('serienr') || currentVal.toLowerCase().includes('frienr')) {
          console.log('rema: serienr string reached at index: ', i);
          startIndex = i;
        }

        if (currentVal.toLowerCase().includes('sum')) {
          console.log('sum reached at index: ', i);

          endIndex = i - startIndex;
          break;
        }
      }
    }

    // const groceriesIncludedTitleAndTotal = [...ocrSplit]; // copy the array
    // console.log('ocrSplit......', groceriesIncludedTitleAndTotal);

    // startIndex -> We increase index, so we dont get 'Salgskvitteringer'
    setEverything([...ocrSplit]); // copy the array before we cut

    // endIndex -> So we dont display Totalt
    const grocerieList = ocrSplit.splice(startIndex + 1, endIndex - 1);
    console.log('GROCERIELIST: ', grocerieList);
    checkIfDiscountText(grocerieList);
  }

  function checkIfDiscountText(grocerieList) {
    let findRabattWordRegEx = new RegExp('Rabatt'); // Er egentlig: /Rabatt/

    const groceriesAndDiscountsList = grocerieList;
    console.log('groceriesAndDiscountsList: ', groceriesAndDiscountsList);

    const updatedGroceriesList = groceriesAndDiscountsList.filter((val) => {
      console.log('val: ', val);

      console.log('rabatt? ', !val.match(findRabattWordRegEx));

      return !val.match(findRabattWordRegEx);
    });
    console.log('groceries after clean up! ', updatedGroceriesList);

    setGroceries(updatedGroceriesList);
  }

  function createGroceryObjects() {
    // const grocery = [...groceries[0]];

    // let matchDecimals = new RegExp('\d+\.\d+');
    let matchDecimals = /\d+\.\d+/g;

    const groceriesList = [...groceries];

    console.log('groceriiiiiii: ', groceriesList);

    const groceryObjects = [];
    const groceryPrices = [];
    let sum = 0;

    // ? Sjekker en grocery om gangen, og finner prisen (prisen er alltid i desimal)
    groceriesList.forEach((grocery) => {
      let price = grocery.match(matchDecimals);

      // ? Hvis det er mer enn 1 pris der, så, har den fått tak i desimal tall som står i varen.. vi trenger alltid siste element! (Prisen er alltid slutten av stringen)
      if (price.length > 1) {
        price = price[price.length - 1]; // Get last element
        console.log('PRICE: ', price);

        groceryPrices.push(parseFloat(price)); // Take out array element and add to list

        // Add price to sum
        sum = sum + parseFloat(price);
      } else {
        // ... -> Since match return ARRAY, we pack it out and add to groceryPrices list
        groceryPrices.push(parseFloat(...grocery.match(matchDecimals)));

        // Add price to sum
        sum = sum + parseFloat(price);
      }

      console.log('MATCH! ', groceryPrices);
    });

    // Set sum so we can display
    setGroceriesSum(sum.toFixed(2));

    const groceryObj = GroceryUtil.createGroceryObj('Potet', 128);

    console.log('groceryPrices: ', groceryPrices);
  }

  // ! RUN WITHOUT SCAN START ------------------------------------------

  function runWithoutScan() {
    setScanProgress(1);
  }

  // runWithoutScan
  // const [ocr, setOcr] = React.useState(`mega
  // Storo »
  // Aeent! 9 - 2P
  // Telefon 25 OG 80 80
  // Norsk Butikkdrift AS
  // Ors.nr 931 186 744 MVA Foretaksreaistenel
  // Butikk 4312-11, CSE6 ;
  // * . Salgskvittering 343517 15 10:2020 1842
  // Coop KIKERTPALEGG 28 .50 ;
  // Coop PUuDDING : 20.00 Å
  // Rabatt: NOK 22.90 (53.4% av 42 ,.90)
  // KNERTEN MINI TOMAT 32 90
  // ; =OMO COLOR 1.17 KG 63.90 |
  // 0M0 ULT.HVITT 1 TKG6 å 58 .90 ;
  // VEGETAR SNITZEL 200G 'i ; 20.00 |
  // Rabatt: NOK 37.90 (65.5% av 57.90) |
  // Totalt (6 Artikler) 22420
  // Bank: 224.20 |
  // Herav ; |
  // Dasl i gvarer 224.20 |
  // Øyrige varer 0.00 ;
  // Rabatter: £0 80 g
  // Miljømerket varer: — « 122580 ;
  // Bax: 14902171-59399$
  // . 12/10/2020 16:45 Overf.. : 832
  // BankAxept Contactless xxx%%xx2651/-6
  // ATD: D5780000021010 '
  // Ref.: 215458 005725 kKo1 TVYR:8000008000 -
  // Resp.: 00
  // : KJØP NOK 224,20
  // GODKJENT
  // ; MVA-srunnlaa | MVA-* MVA Sum :
  // e BR m 19523 101.40
  // - -Éålae mn; 7456 12? Rn ;`);
  // const [ocrSplit, setOcrSplit] = React.useState([
  //   'mega',
  //   '  Storo »',
  //   '  Aeent! 9 - 2P',
  //   '  Telefon 25 OG 80 80',
  //   '  Norsk Butikkdrift AS',
  //   '  Ors.nr 931 186 744 MVA Foretaksreaistenel',
  //   '  Butikk 4312-11, CSE6 ;',
  //   '  * . Salgskvittering 343517 15 10:2020 1842',
  //   '  Coop KIKERTPALEGG 28 .50 ;',
  //   '  Coop PUuDDING : 20.00 Å',
  //   '  Rabatt: NOK 22.90 (53.4% av 42 ,.90)',
  //   '  KNERTEN MINI TOMAT 32 90',
  //   '  ; =OMO COLOR 1.17 KG 63.90 |',
  //   '  0M0 ULT.HVITT 1 TKG6 å 58 .90 ;',
  //   "  VEGETAR SNITZEL 200G 'i ; 20.00 |",
  //   '  Rabatt: NOK 37.90 (65.5% av 57.90) |',
  //   '  Totalt (6 Artikler) 22420',
  //   '  Bank: 224.20 |',
  //   '  Herav ; |',
  //   '  Dasl i gvarer 224.20 |',
  //   '  Øyrige varer 0.00 ;',
  //   '  Rabatter: £0 80 g',
  //   '  Miljømerket varer: — « 122580 ;',
  //   '  Bax: 14902171-59399$',
  //   '  . 12/10/2020 16:45 Overf.. : 832',
  //   '  BankAxept Contactless xxx%%xx2651/-6',
  //   "  ATD: D5780000021010 '",
  //   '  Ref.: 215458 005725 kKo1 TVYR:8000008000 -',
  //   '  Resp.: 00',
  //   '  : KJØP NOK 224,20',
  //   '  GODKJENT',
  //   '  ; MVA-srunnlaa | MVA-* MVA Sum :',
  //   '  e BR m 19523 101.40',
  //   '  - -Éålae mn; 7456 12? Rn ;',
  // ]);

  // ! RUN WITHOUT SCAN END ------------------------------------------

  // Scan from receipt
  const [ocr, setOcr] = React.useState('');
  const [ocrSplit, setOcrSplit] = React.useState([]);

  // Scan cut to only necessary parts
  const [everything, setEverything] = React.useState([]);
  const [storeName, setStoreName] = React.useState('');
  const [groceries, setGroceries] = React.useState([]);
  const [groceriesSum, setGroceriesSum] = React.useState(0);

  // Scan status.
  // 0.0: not started
  // 1: done,
  const [isScanning, setIsScanning] = React.useState(false);
  const [scanProgress, setScanProgress] = React.useState(0.0);

  // Run scan on start
  React.useEffect(() => {
    readNorwegianOCR();

    // runWithoutScan
    // runWithoutScan();
    // getStore();
    // getGroceries();
  }, []);

  React.useEffect(() => {
    getStore();
  }, [ocrSplit]);

  // ? Runs getGroceries func when storeName gets value (when setStoreName is called, check getStore() function)
  React.useEffect(() => {
    getGroceries();
  }, [storeName]);

  // ? Run function, when groceries is updated
  React.useEffect(() => {
    createGroceryObjects();
  }, [groceries]);

  return (
    <>
      <Container>{isScanning && <ProgressBar max="1" value={scanProgress}></ProgressBar>}</Container>

      <Container>
        <PhotoContainer>
          <img src={img} alt="wth" width={300} />
          <ScanButton onClick={readNorwegianOCR} disabled={isScanning}>
            Scan picture
          </ScanButton>
        </PhotoContainer>

        <ResultContainer>
          <h2>STORE NAME: {storeName}</h2>
          <button onClick={getStore} disabled={scanProgress != 1}>
            Find store name
          </button>

          {/* ? Skriver ut hver enkel ord ocr fant */}
          {/* {ocr.split('\n').map((val, idx) => (
            <p key={idx}>{val}</p>
          ))} */}

          {/* Skriver ut varene etter den har blitt fjernet for rabatter */}
          {groceries.map((val, idx) => (
            <p key={idx}>{val}</p>
          ))}

          <AmountOfGroceries>Amount og groceries: {groceries.length}</AmountOfGroceries>
          <SumText visible={scanProgress === 1}>Sum: {groceriesSum}</SumText>
        </ResultContainer>
      </Container>
    </>
  );
}

export default App;

const Container = styled.div`
  max-width: 68em;
  margin: 2em auto;
  display: flex;
  justify-content: space-between;
`;

const ProgressBar = styled.progress`
  width: 90%;
  height: 3em;
  margin: auto;
  color: red;
`;

const PhotoContainer = styled.div`
  display: flex;
  flex-flow: column nowrap;
  justify-content: space-evenly;
  align-items: center;
  width: 48%;
`;

const ResultContainer = styled.div`
  width: 48%;
`;

const PrimaryButton = styled.button``;

const ScanButton = styled.button`
  font-size: 2em;
  padding: 1em 2em;
  border-radius: 5px;
  outline: none;
  border: 0;
  cursor: pointer;
  background: #db4d52;
  color: white;

  :hover {
    background: #ff474d;
  }

  :disabled {
    background: #ffadb0;
    cursor: wait;
  }
`;

const AmountOfGroceries = styled.p`
  font-size: 2em;
  visibility: ${(props) => (props.visible ? 'visible' : 'hidden')};
`;

const SumText = styled.p`
  font-size: 4em;
  visibility: ${(props) => (props.visible ? 'visible' : 'hidden')};
`;
