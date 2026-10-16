const sharp = require('sharp');
const { createWorker, OEM, PSM } = require('tesseract.js');

function groupLines(indices) {
  const groups=[];
  for(const value of indices){const last=groups.at(-1);if(!last||value>last.at(-1)+1)groups.push([value]);else last.push(value);}
  return groups.map(g=>Math.round(g.reduce((a,b)=>a+b,0)/g.length));
}

async function tableBounds(imagePath) {
  const { data, info } = await sharp(imagePath).removeAlpha().raw().toBuffer({ resolveWithObject:true });
  const bright=(x,y)=>{const i=(y*info.width+x)*info.channels;return data[i]>215&&data[i+1]>225&&data[i+2]>205;};
  const horizontal=[];
  for(let y=0;y<info.height;y++){let count=0;for(let x=0;x<info.width;x++)if(bright(x,y))count++;if(count/info.width>.68)horizontal.push(y);}
  const vertical=[];
  for(let x=0;x<info.width;x++){let count=0;for(let y=0;y<info.height;y++)if(bright(x,y))count++;if(count/info.height>.68)vertical.push(x);}
  let ys=groupLines(horizontal),xs=groupLines(vertical);
  if(ys[0]>3)ys.unshift(0);if(ys.at(-1)<info.height-4)ys.push(info.height-1);
  if(xs[0]>3)xs.unshift(0);if(xs.at(-1)<info.width-4)xs.push(info.width-1);
  if(xs.length<3||ys.length<3)throw new Error('Não consegui identificar as colunas Hab e Efeito. Use uma imagem com a tabela inteira.');
  const columns=xs.length>=4?[xs[0],xs[1],xs.at(-2),xs.at(-1)]:[xs[0],xs[1],xs.at(-1)];
  return { width:info.width,height:info.height,xs:columns,ys,hasLevel:columns.length===4 };
}

async function cropCell(imagePath,left,top,right,bottom) {
  const pad=4;
  return sharp(imagePath).extract({left:Math.max(0,left+pad),top:Math.max(0,top+pad),width:Math.max(1,right-left-pad*2),height:Math.max(1,bottom-top-pad*2)})
    .grayscale().normalize().resize({width:Math.max(360,(right-left-pad*2)*3),kernel:'lanczos3'}).threshold(175).png().toBuffer();
}

function cleanText(text) { return String(text||'').replace(/\s*\n\s*/g,' ').replace(/\s+/g,' ').replace(/^[|:;.,_\-\s]+|[|_\s]+$/g,'').trim(); }

async function readAbilityTable(imagePath, options) {
  const bounds=await tableBounds(imagePath);
  const worker=await createWorker('por',OEM.LSTM_ONLY,options);
  const abilities=[];
  try{
    for(let row=1;row<bounds.ys.length-1;row++){
      const top=bounds.ys[row],bottom=bounds.ys[row+1];
      if(bottom-top<10)continue;
      const buffers=await Promise.all([
        cropCell(imagePath,bounds.xs[0],top,bounds.xs[1],bottom),
        cropCell(imagePath,bounds.xs[1],top,bounds.xs[2],bottom),
        bounds.hasLevel?cropCell(imagePath,bounds.xs[2]+14,top,bounds.xs[3],bottom):Promise.resolve(null)
      ]);
      const [nameBuffer,effectBuffer,levelBuffer]=buffers;
      await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK,tessedit_char_whitelist:''});
      const name=cleanText((await worker.recognize(nameBuffer)).data.text);
      const effect=cleanText((await worker.recognize(effectBuffer)).data.text);
      let levelText='1';
      if(levelBuffer){await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_CHAR,tessedit_char_whitelist:'0123456789'});levelText=cleanText((await worker.recognize(levelBuffer)).data.text);}
      if(name&&!/^(hab|habilidade)$/i.test(name)&&effect)abilities.push({name,effect,level:Number(levelText.match(/\d+/)?.[0])||1});
    }
  }finally{await worker.terminate();}
  return abilities;
}

module.exports={readAbilityTable,tableBounds,cleanText};
