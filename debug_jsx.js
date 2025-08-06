// Quick script to check JSX balance
const fs = require('fs');
const content = fs.readFileSync('./client/src/pages/UnifiedVideoEditor.tsx', 'utf8');

let divCount = 0;
let braceCount = 0;
let insideJSX = false;

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('return (')) {
    insideJSX = true;
    console.log(`JSX starts at line ${i + 1}: ${line.trim()}`);
  }
  
  if (insideJSX) {
    // Count opening and closing divs
    const openDivs = (line.match(/<div[^>]*>/g) || []).length;
    const closeDivs = (line.match(/<\/div>/g) || []).length;
    divCount += openDivs - closeDivs;
    
    if (openDivs > 0 || closeDivs > 0) {
      console.log(`Line ${i + 1}: +${openDivs} -${closeDivs} = ${divCount} total | ${line.trim()}`);
    }
  }
  
  if (line.includes('  );') || line.includes('  }')) {
    console.log(`JSX ends at line ${i + 1}: ${line.trim()}, final div count: ${divCount}`);
    break;
  }
}

console.log(`Final div balance: ${divCount}`);