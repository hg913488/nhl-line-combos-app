import { useState, useMemo, useEffect } from "react";

const UPDATED_AT = "2026-03-01";
const TEAMS_DATA = {"anaheim-ducks":{"forwards":[["CHRIS KREIDER","LEO CARLSSON","CUTTER GAUTHIER"],["JEFFREY VIEL","MASON MCTAVISH","BECKETT SENNECKE"],["JANSEN HARKINS","RYAN POEHLING","ALEX KILLORN"],["ROSS JOHNSTON","TIM WASHE","FRANK VATRANO"]],"defense":[["JACKSON LACOMBE","JACOB TROUBA"],["OLEN ZELLWEGER","RADKO GUDAS"],["PAVEL MINTYUKOV","DREW HELLESON"]],"goalies":[["LUKAS DOSTAL"],["VILLE HUSSO"]]},"boston-bruins":{"forwards":[["MORGAN GEEKIE","ELIAS LINDHOLM","DAVID PASTRNAK"],["CASEY MITTELSTADT","PAVEL ZACHA","VIKTOR ARVIDSSON"],["MICHAEL EYSSIMONT","FRASER MINTEN","MARAT KHUSNUTDINOV"],["TANNER JEANNOT","SEAN KURALY","MARK KASTELIC"]],"defense":[["JONATHAN ASPIROT","CHARLIE MCAVOY"],["HAMPUS LINDHOLM","MASON LOHREI"],["NIKITA ZADOROV","HENRI JOKIHARJU"]],"goalies":[["JEREMY SWAYMAN"],["JOONAS KORPISALO"]]},"buffalo-sabres":{"forwards":[["PEYTON KREBS","TAGE THOMPSON","ALEX TUCH"],["JASON ZUCKER","RYAN MCLEOD","JACK QUINN"],["NOAH OSTLUND","JOSH NORRIS","JOSH DOAN"],["ZACH BENSON","TYSON KOZAK","BECK MALENSTYN"]],"defense":[["MATTIAS SAMUELSSON","RASMUS DAHLIN"],["BOWEN BYRAM","OWEN POWER"],["ZACH METSA","MICHAEL KESSELRING"]],"goalies":[["UKKO-PEKKA LUUKKONEN"],["ALEX LYON"]]},"calgary-flames":{"forwards":[["CONNOR ZARY","NAZEM KADRI","JOEL FARABEE"],["YEGOR SHARANGOVICH","MIKAEL BACKLUND","MATT CORONATO"],["BLAKE COLEMAN","MORGAN FROST","MATVEI GRIDIN"],["MARTIN POSPISIL","JOHN BEECHER","ADAM KLAPKA"]],"defense":[["KEVIN BAHL","MACKENZIE WEEGAR"],["YAN KUZNETSOV","ZACH WHITECLOUD"],["JOEL HANLEY","ZAYNE PAREKH"]],"goalies":[["DEVIN COOLEY"],["DUSTIN WOLF"]]},"carolina-hurricanes":{"forwards":[["ANDREI SVECHNIKOV","SEBASTIAN AHO","SETH JARVIS"],["TAYLOR HALL","LOGAN STANKOVEN","JACKSON BLAKE"],["NIKOLAJ EHLERS","JORDAN STAAL","JORDAN MARTINOOK"],["WILLIAM CARRIER","MARK JANKOWSKI","ERIC ROBINSON"]],"defense":[["JACCOB SLAVIN","JALEN CHATFIELD"],["K'ANDRE MILLER","SEAN WALKER"],["SHAYNE GOSTISBEHERE","ALEXANDER NIKISHIN"]],"goalies":[["BRANDON BUSSI"],["FREDERIK ANDERSEN"]]},"chicago-blackhawks":{"forwards":[["RYAN GREENE","CONNOR BEDARD","ANDRE BURAKOVSKY"],["OLIVER MOORE","FRANK NAZAR","TEUVO TERAVAINEN"],["TYLER BERTUZZI","JASON DICKINSON","ILYA MIKHEYEV"],["RYAN DONATO","NICK FOLIGNO","COLTON DACH"]],"defense":[["ALEX VLASIC","LOUIS CREVIER"],["CONNOR MURPHY","KEVIN KORCHINSKI"],["MATT GRZELCYK","ARTYOM LEVSHUNOV"]],"goalies":[["ARVID SODERBLOM"],["SPENCER KNIGHT"]]},"colorado-avalanche":{"forwards":[["GABRIEL LANDESKOG","NATHAN MACKINNON","MARTIN NECAS"],["ARTTURI LEHKONEN","BROCK NELSON","VALERI NICHUSHKIN"],["ROSS COLTON","JACK DRURY","VICTOR OLOFSSON"],["ZAKHAR BARDAKOV","PARKER KELLY","GAVIN BRINDLEY"]],"defense":[["DEVON TOEWS","CALE MAKAR"],["JOSH MANSON","BRENT BURNS"],["BRETT KULAK","SAM MALINSKI"]],"goalies":[["MACKENZIE BLACKWOOD"],["SCOTT WEDGEWOOD"]]},"columbus-blue-jackets":{"forwards":[["MASON MARCHMENT","ADAM FANTILLI","KIRILL MARCHENKO"],["BOONE JENNER","SEAN MONAHAN","DANTON HEINEN"],["COLE SILLINGER","CHARLIE COYLE","MATHIEU OLIVIER"],["DMITRI VORONKOV","ISAC LUNDESTROM","MILES WOOD"]],"defense":[["ZACH WERENSKI","DAMON SEVERSON"],["IVAN PROVOROV","DENTON MATEYCHUK"],["DANTE FABBRO","ERIK GUDBRANSON"]],"goalies":[["ELVIS MERZLIKINS"],["JET GREAVES"]]},"dallas-stars":{"forwards":[["JASON ROBERTSON","WYATT JOHNSTON","MAVRIK BOURQUE"],["SAM STEEL","MATT DUCHENE","JAMIE BENN"],["ADAM ERNE","JUSTIN HRYCKOWIAN","COLIN BLACKWELL"],["OSKAR BACK","ARTTU HYRY","NATHAN BASTIAN"]],"defense":[["ESA LINDELL","MIRO HEISKANEN"],["THOMAS HARLEY","NILS LUNDKVIST"],["LIAN BICHSEL","ILYA LYUBUSHKIN"]],"goalies":[["JAKE OETTINGER"],["CASEY DESMITH"]]},"detroit-red-wings":{"forwards":[["MARCO KASPER","DYLAN LARKIN","LUCAS RAYMOND"],["ALEX DEBRINCAT","ANDREW COPP","PATRICK KANE"],["EMMITT FINNIE","J.T. COMPHER","MASON APPLETON"],["DOMINIK SHINE","MICHAEL RASMUSSEN","JAMES VAN RIEMSDYK"]],"defense":[["SIMON EDVINSSON","MORITZ SEIDER"],["ALBERT JOHANSSON","AXEL SANDIN-PELLIKKA"],["BEN CHIAROT","JACOB BERNARD-DOCKER"]],"goalies":[["CAM TALBOT"],["JOHN GIBSON"]]},"edmonton-oilers":{"forwards":[["RYAN NUGENT-HOPKINS","CONNOR MCDAVID","ZACH HYMAN"],["MATTHEW SAVOIE","LEON DRAISAITL","JACK ROSLOVIC"],["VASILY PODKOLZIN","ADAM HENRIQUE","TRENT FREDERIC"],["ANDREW MANGIAPANE","CURTIS LAZAR","KASPERI KAPANEN"]],"defense":[["MATTIAS EKHOLM","EVAN BOUCHARD"],["DARNELL NURSE","JAKE WALMAN"],["SPENCER STASTNEY","TY EMBERSON"]],"goalies":[["TRISTAN JARRY"],["CONNOR INGRAM"]]},"florida-panthers":{"forwards":[["CARTER VERHAEGHE","EVAN RODRIGUES","SAM REINHART"],["MACKIE SAMOSKEVICH","SAM BENNETT","MATTHEW TKACHUK"],["EETU LUOSTARINEN","ANTON LUNDELL","BRAD MARCHAND"],["A.J. GREER","LUKE KUNIN","SANDIS VILMANIS"]],"defense":[["GUSTAV FORSLING","AARON EKBLAD"],["NIKO MIKKOLA","DMITRY KULIKOV"],["DONOVAN SEBRANGO","JEFF PETRY"]],"goalies":[["SERGEI BOBROVSKY"],["DANIIL TARASOV"]]},"los-angeles-kings":{"forwards":[["ARTEMI PANARIN","ANZE KOPITAR","ADRIAN KEMPE"],["TREVOR MOORE","QUINTON BYFIELD","ALEX LAFERRIERE"],["WARREN FOEGELE","ALEX TURCOTTE","COREY PERRY"],["JEFF MALOTT","SAMUEL HELENIUS","TAYLOR WARD"]],"defense":[["JOEL EDMUNDSON","BRANDT CLARKE"],["MIKEY ANDERSON","CODY CECI"],["JACOB MOVERARE","BRIAN DUMOULIN"]],"goalies":[["DARCY KUEMPER"],["ANTON FORSBERG"]]},"minnesota-wild":{"forwards":[["KIRILL KAPRIZOV","RYAN HARTMAN","MATS ZUCCARELLO"],["MARCUS JOHANSSON","JOEL ERIKSSON EK","MATT BOLDY"],["YAKOV TRENIN","DANILA YUROV","VLADIMIR TARASENKO"],["MARCUS FOLIGNO","NICO STURM","VINNIE HINOSTROZA"]],"defense":[["QUINN HUGHES","BROCK FABER"],["JACOB MIDDLETON","JARED SPURGEON"],["DAEMON HUNT","ZACH BOGOSIAN"]],"goalies":[["FILIP GUSTAVSSON"],["JESPER WALLSTEDT"]]},"montreal-canadiens":{"forwards":[["COLE CAUFIELD","NICK SUZUKI","KIRBY DACH"],["JURAJ SLAFKOVSKY","OLIVER KAPANEN","IVAN DEMIDOV"],["JOSH ANDERSON","PHILLIP DANAULT","BRENDAN GALLAGHER"],["ZACK BOLDUC","JAKE EVANS","ALEX NEWHOOK"]],"defense":[["LANE HUTSON","NOAH DOBSON"],["MIKE MATHESON","KAIDEN GUHLE"],["JAYDEN STRUBLE","ALEXANDRE CARRIER"]],"goalies":[["JAKUB DOBES"],["SAM MONTEMBEAULT"]]},"nashville-predators":{"forwards":[["LUKE EVANGELISTA","RYAN O'REILLY","STEVEN STAMKOS"],["FILIP FORSBERG","ERIK HAULA","JONATHAN MARCHESSAULT"],["MICHAEL BUNTING","MICHAEL MCCARRON","COLE SMITH"],["ZACHARY L'HEUREUX","TYSON JOST","MATTHEW WOOD"]],"defense":[["BRADY SKJEI","ROMAN JOSI"],["ADAM WILSBY","NICK PERBIX"],["NICOLAS HAGUE","NICK BLANKENBURG"]],"goalies":[["JUUSE SAROS"],["JUSTUS ANNUNEN"]]},"new-jersey-devils":{"forwards":[["TIMO MEIER","NICO HISCHIER","DAWSON MERCER"],["ARSENY GRITSYUK","JACK HUGHES","CONNOR BROWN"],["JESPER BRATT","CODY GLASS","LENNI HAMEENAHO"],["PAUL COTTER","NICK BJUGSTAD","MAXIM TSYPLAKOV"]],"defense":[["LUKE HUGHES","BRETT PESCE"],["JONAS SIEGENTHALER","DOUGIE HAMILTON"],["BRENDEN DILLON","SIMON NEMEC"]],"goalies":[["JACOB MARKSTROM"],["JAKE ALLEN"]]},"new-york-islanders":{"forwards":[["ONDREJ PALAT","BO HORVAT","MATHEW BARZAL"],["JONATHAN DROUIN","CALUM RITCHIE","EMIL HEINEMAN"],["ANDERS LEE","JEAN-GABRIEL PAGEAU","SIMON HOLMSTROM"],["KYLE MACLEAN","CASEY CIZIKAS","MARC GATCOMB"]],"defense":[["MATTHEW SCHAEFER","RYAN PULOCK"],["ADAM PELECH","TONY DEANGELO"],["CARSON SOUCY","SCOTT MAYFIELD"]],"goalies":[["DAVID RITTICH"],["ILYA SOROKIN"]]},"new-york-rangers":{"forwards":[["J.T. MILLER","MIKA ZIBANEJAD","GABRIEL PERREAULT"],["WILL CUYLLE","VINCENT TROCHECK","ALEXIS LAFRENIÈRE"],["TYE KARTYE","NOAH LABA","BRENDAN BRISSON"],["CONOR SHEARY","SAM CARRICK","TAYLOR RADDYSH"]],"defense":[["VLADISLAV GAVRIKOV","ADAM FOX"],["BRADEN SCHNEIDER","WILL BORGEN"],["MATTHEW ROBERTSON","SCOTT MORROW"]],"goalies":[["IGOR SHESTERKIN"],["JONATHAN QUICK"]]},"ottawa-senators":{"forwards":[["DRAKE BATHERSON","TIM STÜTZLE","CLAUDE GIROUX"],["BRADY TKACHUK","DYLAN COZENS","RIDLY GREIG"],["NICK COUSINS","SHANE PINTO","MICHAEL AMADIO"],["STEPHEN HALLIDAY","LARS ELLER","FABIAN ZETTERLUND"]],"defense":[["JAKE SANDERSON","ARTEM ZUB"],["THOMAS CHABOT","NICK JENSEN"],["TYLER KLEVEN","JORDAN SPENCE"]],"goalies":[["LINUS ULLMARK"],["JAMES REIMER"]]},"philadelphia-flyers":{"forwards":[["TREVOR ZEGRAS","CHRISTIAN DVORAK","TRAVIS KONECNY"],["MATVEI MICHKOV","NOAH CATES","BOBBY BRINK"],["NIKITA GREBENKIN","SEAN COUTURIER","OWEN TIPPETT"],["NICOLAS DESLAURIERS","CARL GRUNDSTROM","GARNET HATHAWAY"]],"defense":[["TRAVIS SANHEIM","RASMUS RISTOLAINEN"],["CAM YORK","JAMIE DRYSDALE"],["EMIL ANDRAE","NICK SEELER"]],"goalies":[["DAN VLADAR"],["SAMUEL ERSSON"]]},"pittsburgh-penguins":{"forwards":[["EGOR CHINAKHOV","TOMMY NOVAK","EVGENI MALKIN"],["AVERY HAYES","RICKARD RAKELL","BRYAN RUST"],["ANTHONY MANTHA","BEN KINDEL","JUSTIN BRAZEAU"],["CONNOR DEWAR","BLAKE LIZOTTE","NOEL ACCIARI"]],"defense":[["PARKER WOTHERSPOON","ERIK KARLSSON"],["SAMUEL GIRARD","KRIS LETANG"],["RYAN SHEA","CONNOR CLIFTON"]],"goalies":[["ARTURS SILOVS"],["STUART SKINNER"]]},"san-jose-sharks":{"forwards":[["WILL SMITH","MACKLIN CELEBRINI","KIEFER SHERWOOD"],["WILLIAM EKLUND","MICHAEL MISA","TYLER TOFFOLI"],["COLLIN GRAF","ALEXANDER WENNBERG","PHILIPP KURASHEV"],["BARCLAY GOODROW","ZACK OSTAPCHUK","PAVOL REGENDA"]],"defense":[["DMITRY ORLOV","JOHN KLINGBERG"],["MARIO FERRARO","SHAKIR MUKHAMADULLIN"],["SAM DICKINSON","VINCENT DESHARNAIS"]],"goalies":[["ALEX NEDELJKOVIC"],["YAROSLAV ASKAROV"]]},"seattle-kraken":{"forwards":[["JARED MCCANN","MATTY BENIERS","JORDAN EBERLE"],["JADEN SCHWARTZ","CHANDLER STEPHENSON","EELI TOLVANEN"],["BERKLY CATTON","SHANE WRIGHT","KAAPO KAKKO"],["BEN MEYERS","FREDERICK GAUDREAU","JACOB MELANSON"]],"defense":[["VINCE DUNN","ADAM LARSSON"],["JAMIE OLEKSIAK","BRANDON MONTOUR"],["CALE FLEURY","RYKER EVANS"]],"goalies":[["JOEY DACCORD"],["PHILIPP GRUBAUER"]]},"st-louis-blues":{"forwards":[["PAVEL BUCHNEVICH","ROBERT THOMAS","JORDAN KYROU"],["JAKE NEIGHBOURS","DALIBOR DVORSKY","JIMMY SNUGGERUD"],["DYLAN HOLLOWAY","PIUS SUTER","BRAYDEN SCHENN"],["ALEXEY TOROPCHENKO","JACK FINLEY","NATHAN WALKER"]],"defense":[["PHILIP BROBERG","JUSTIN FAULK"],["CAM FOWLER","LOGAN MAILLOUX"],["TYLER TUCKER","MATTHEW KESSEL"]],"goalies":[["JOEL HOFER"],["JORDAN BINNINGTON"]]},"tampa-bay-lightning":{"forwards":[["GAGE GONCALVES","BRAYDEN POINT","NIKITA KUCHEROV"],["BRANDON HAGEL","ANTHONY CIRELLI","JAKE GUENTZEL"],["ZEMGUS GIRGENSONS","YANNI GOURDE","PONTUS HOLMBERG"],["DOMINIC JAMES","OLIVER BJORKSTRAND"]],"defense":[["J.J. MOSER","DARREN RADDYSH"],["CHARLE-EDOUARD D'ASTOUS","VICTOR HEDMAN"],["RYAN MCDONAGH","ERIK CERNAK"]],"goalies":[["ANDREI VASILEVSKIY"],["JONAS JOHANSSON"]]},"toronto-maple-leafs":{"forwards":[["MATTHEW KNIES","AUSTON MATTHEWS","MAX DOMI"],["MATIAS MACCELLI","JOHN TAVARES","WILLIAM NYLANDER"],["EASTON COWAN","NICOLAS ROY","BOBBY MCMANN"],["DAKOTA JOSHUA","SCOTT LAUGHTON","NICHOLAS ROBERTSON"]],"defense":[["MORGAN RIELLY","BRANDON CARLO"],["JAKE MCCABE","TROY STECHER"],["SIMON BENOIT","OLIVER EKMAN-LARSSON"]],"goalies":[["JOSEPH WOLL"],["ANTHONY STOLARZ"]]},"utah-mammoth":{"forwards":[["CLAYTON KELLER","NICK SCHMALTZ","LAWSON CROUSE"],["JACK MCBAIN","LOGAN COOLEY","DYLAN GUENTHER"],["JJ PETERKA","BARRETT HAYTON","KAILER YAMAMOTO"],["ALEX KERFOOT","KEVIN STENLUND","MICHAEL CARCONE"]],"defense":[["MIKHAIL SERGACHEV","SEAN DURZI"],["NATE SCHMIDT","JOHN MARINO"],["IAN COLE","OLLI MAATTA"]],"goalies":[["KAREL VEJMELKA"],["VITEK VANECEK"]]},"vancouver-canucks":{"forwards":[["EVANDER KANE","ELIAS PETTERSSON","JAKE DEBRUSK"],["DREW O'CONNOR","MARCO ROSSI","BROCK BOESER"],["LIAM OHGREN","TEDDY BLUEGER","CONOR GARLAND"],["NILS HOGLANDER","DAVID KAMPF","LINUS KARLSSON"]],"defense":[["ELIAS NILS PETTERSSON","FILIP HRONEK"],["MARCUS PETTERSSON","TOM WILLANDER"],["ZEEV BUIUM","PIERRE-OLIVIER JOSEPH"]],"goalies":[["KEVIN LANKINEN"],["NIKITA TOLOPILO"]]},"vegas-golden-knights":{"forwards":[["IVAN BARBASHEV","JACK EICHEL","MARK STONE"],["REILLY SMITH","MITCH MARNER","PAVEL DOROFEYEV"],["BRAEDEN BOWMAN","TOMAS HERTL","KEEGAN KOLESAR"],["BRANDON SAAD","COLTON SISSONS","COLE REINHARDT"]],"defense":[["JEREMY LAUZON","SHEA THEODORE"],["NOAH HANIFIN","RASMUS ANDERSSON"],["BRAYDEN MCNABB","KAEDAN KORCZAK"]],"goalies":[["ADIN HILL"],["AKIRA SCHMID"]]},"washington-capitals":{"forwards":[["ALEX OVECHKIN","DYLAN STROME","ANTHONY BEAUVILLIER"],["ALIAKSEI PROTAS","PIERRE-LUC DUBOIS","TOM WILSON"],["CONNOR MCMICHAEL","JUSTIN SOURDIF","RYAN LEONARD"],["BRANDON DUHAIME","NIC DOWD","ETHEN FRANK"]],"defense":[["MARTIN FEHERVARY","RASMUS SANDIN"],["JAKOB CHYCHRUN","MATT ROY"],["DECLAN CHISHOLM","TREVOR VAN RIEMSDYK"]],"goalies":[["CHARLIE LINDGREN"],["LOGAN THOMPSON"]]},"winnipeg-jets":{"forwards":[["KYLE CONNOR","MARK SCHEIFELE","GABRIEL VILARDI"],["COLE PERFETTI","ADAM LOWRY","ALEX IAFALLO"],["GUSTAV NYQUIST","JONATHAN TOEWS","WALKER DUEHR"],["COLE KOEPKE","MORGAN BARRON","TANNER PEARSON"]],"defense":[["LOGAN STANLEY","DYLAN DEMELO"],["DYLAN SAMBERG","ELIAS SALOMONSSON"],["HAYDN FLEURY","LUKE SCHENN"]],"goalies":[["CONNOR HELLEBUYCK"],["ERIC COMRIE"]]}};

const NHL_TEAMS = {
  "anaheim-ducks":        { city: "Anaheim",      name: "Ducks",         abbr: "ANA" },
  "boston-bruins":        { city: "Boston",       name: "Bruins",        abbr: "BOS" },
  "buffalo-sabres":       { city: "Buffalo",      name: "Sabres",        abbr: "BUF" },
  "calgary-flames":       { city: "Calgary",      name: "Flames",        abbr: "CGY" },
  "carolina-hurricanes":  { city: "Carolina",     name: "Hurricanes",    abbr: "CAR" },
  "chicago-blackhawks":   { city: "Chicago",      name: "Blackhawks",    abbr: "CHI" },
  "colorado-avalanche":   { city: "Colorado",     name: "Avalanche",     abbr: "COL" },
  "columbus-blue-jackets":{ city: "Columbus",     name: "Blue Jackets",  abbr: "CBJ" },
  "dallas-stars":         { city: "Dallas",       name: "Stars",         abbr: "DAL" },
  "detroit-red-wings":    { city: "Detroit",      name: "Red Wings",     abbr: "DET" },
  "edmonton-oilers":      { city: "Edmonton",     name: "Oilers",        abbr: "EDM" },
  "florida-panthers":     { city: "Florida",      name: "Panthers",      abbr: "FLA" },
  "los-angeles-kings":    { city: "Los Angeles",  name: "Kings",         abbr: "LA"  },
  "minnesota-wild":       { city: "Minnesota",    name: "Wild",          abbr: "MIN" },
  "montreal-canadiens":   { city: "Montréal",     name: "Canadiens",     abbr: "MTL" },
  "nashville-predators":  { city: "Nashville",    name: "Predators",     abbr: "NSH" },
  "new-jersey-devils":    { city: "New Jersey",   name: "Devils",        abbr: "NJD" },
  "new-york-islanders":   { city: "NY Isles",     name: "Islanders",     abbr: "NYI" },
  "new-york-rangers":     { city: "NY Rangers",   name: "Rangers",       abbr: "NYR" },
  "ottawa-senators":      { city: "Ottawa",       name: "Senators",      abbr: "OTT" },
  "philadelphia-flyers":  { city: "Philadelphia", name: "Flyers",        abbr: "PHI" },
  "pittsburgh-penguins":  { city: "Pittsburgh",   name: "Penguins",      abbr: "PIT" },
  "san-jose-sharks":      { city: "San Jose",     name: "Sharks",        abbr: "SJS" },
  "seattle-kraken":       { city: "Seattle",      name: "Kraken",        abbr: "SEA" },
  "st-louis-blues":       { city: "St. Louis",    name: "Blues",         abbr: "STL" },
  "tampa-bay-lightning":  { city: "Tampa Bay",    name: "Lightning",     abbr: "TBL" },
  "toronto-maple-leafs":  { city: "Toronto",      name: "Maple Leafs",   abbr: "TOR" },
  "utah-mammoth":         { city: "Utah",         name: "Mammoth",       abbr: "UTA" },
  "vancouver-canucks":    { city: "Vancouver",    name: "Canucks",       abbr: "VAN" },
  "vegas-golden-knights": { city: "Vegas",        name: "Golden Knights",abbr: "VGK" },
  "washington-capitals":  { city: "Washington",   name: "Capitals",      abbr: "WSH" },
  "winnipeg-jets":        { city: "Winnipeg",     name: "Jets",          abbr: "WPG" },
};

const P = {
  bg: "#0d0d0d", surface: "#161616", border: "#252525",
  dove: "#686B6C", casper: "#B8C4CA", white: "#F0F0F0", dim: "#3a3a3a",
  hover: "#1a2530", active: "#1e2d3d",
};

const LOGO = (abbr) => `https://assets.nhle.com/logos/nhl/svg/${abbr}_dark.svg`;
const COLLAPSED_W = 100;
const EXPANDED_W = 320;

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: ${P.bg}; height: 100%; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${P.dim}; border-radius: 2px; }
  input:focus { outline: none; }

  /* Desktop strips */
  .strip {
    flex-shrink: 0;
    width: ${COLLAPSED_W}px;
    transition: width 0.35s cubic-bezier(0.4,0,0.2,1), background 0.15s;
    overflow: hidden;
    cursor: pointer;
    border-right: 1px solid ${P.border};
    position: relative;
    background: ${P.surface};
    user-select: none;
  }
  .strip:last-child { border-right: none; }
  .strip:hover { background: ${P.hover}; }
  .strip.expanded { width: ${EXPANDED_W}px; background: ${P.active}; }
  .strip.expanded:hover { background: ${P.active}; }

  /* Mobile accordion */
  .mobile-row {
    border-bottom: 1px solid ${P.border};
    background: ${P.surface};
    cursor: pointer;
    transition: background 0.15s;
  }
  .mobile-row:hover { background: ${P.hover}; }
  .mobile-row.open { background: ${P.active}; }
  .mobile-body {
    overflow: hidden;
    max-height: 0;
    transition: max-height 0.35s cubic-bezier(0.4,0,0.2,1);
  }
  .mobile-body.open { max-height: 2000px; }
`;

function TeamLogo({ abbr, size = 48 }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div style={{ width: size, height: size, borderRadius: 6, background: P.dim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.22, fontWeight: 800, color: P.white, flexShrink: 0 }}>
        {abbr}
      </div>
    );
  }
  return (
    <img src={LOGO(abbr)} alt={abbr} width={size} height={size}
      onError={() => setErr(true)}
      style={{ objectFit: "contain", flexShrink: 0 }} />
  );
}

function PlayerCard({ name, pos }) {
  const parts = name.split(" ");
  const last = parts.slice(-1)[0];
  const first = parts.slice(0, -1).join(" ");
  return (
    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 4, padding: "6px 4px", display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 8, fontWeight: 700, color: P.dove, letterSpacing: "0.1em", marginBottom: 3 }}>{pos}</span>
      <span style={{ fontSize: 8, color: P.dove, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", textAlign: "center" }}>{first}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: P.white, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", textAlign: "center" }}>{last}</span>
    </div>
  );
}

function ForwardLine({ line, lineNum }) {
  const pos = line.length === 3 ? ["LW","C","RW"] : line.length === 2 ? ["C","RW"] : ["C"];
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: P.casper, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 5 }}>LINE {lineNum}</div>
      <div style={{ display: "flex", gap: 4 }}>
        {line.map((p, i) => <PlayerCard key={i} name={p} pos={pos[i]} />)}
      </div>
    </div>
  );
}

function DefensePair({ pair, pairNum }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: P.dove, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 5 }}>PAIR {pairNum}</div>
      <div style={{ display: "flex", gap: 4 }}>
        {pair.map((p, i) => <PlayerCard key={i} name={p} pos={i === 0 ? "LD" : "RD"} />)}
      </div>
    </div>
  );
}

function Divider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 10px" }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: P.casper, letterSpacing: "0.14em", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: P.border }} />
    </div>
  );
}

function LineupContent({ data, abbr }) {
  const fwd = data.forwards || [], def = data.defense || [], gol = data.goalies || [];
  return (
    <>
      <Divider label="FORWARDS" />
      {fwd.map((line, i) => <ForwardLine key={i} line={line} lineNum={i + 1} />)}
      <Divider label="DEFENSE" />
      {def.map((pair, i) => <DefensePair key={i} pair={pair} pairNum={i + 1} />)}
      {gol.length > 0 && (
        <>
          <Divider label="GOALIES" />
          <div style={{ display: "flex", gap: 4 }}>
            {gol.map((g, i) => <PlayerCard key={i} name={g[0]} pos={i === 0 ? "STR" : "BKP"} />)}
          </div>
        </>
      )}
    </>
  );
}

// ── Desktop horizontal strip ──────────────────────────────────────────
function TeamStrip({ slug, data, expanded, onToggle }) {
  const t = NHL_TEAMS[slug] || { city: slug, name: "", abbr: "?" };
  return (
    <div className={`strip${expanded ? " expanded" : ""}`} onClick={onToggle}>
      {/* Collapsed */}
      <div style={{
        position: "absolute", top: 0, left: 0, width: COLLAPSED_W, height: "100%",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
        opacity: expanded ? 0 : 1, transition: "opacity 0.15s", pointerEvents: "none", padding: "0 10px",
      }}>
        <TeamLogo abbr={t.abbr} size={52} />
        <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 10, fontWeight: 600, color: P.casper, letterSpacing: "0.14em", whiteSpace: "nowrap" }}>
          {t.city.toUpperCase()}
        </div>
      </div>

      {/* Expanded */}
      <div style={{
        opacity: expanded ? 1 : 0, transition: "opacity 0.2s 0.15s",
        padding: "18px 16px", minWidth: EXPANDED_W,
        pointerEvents: expanded ? "auto" : "none",
        overflowY: "auto", maxHeight: "calc(100vh - 52px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 14, borderBottom: `1px solid ${P.border}` }}>
          <TeamLogo abbr={t.abbr} size={48} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: P.white, lineHeight: 1.1 }}>{t.city}</div>
            <div style={{ fontSize: 11, color: P.dove, marginTop: 2 }}>{t.name}</div>
          </div>
        </div>
        <LineupContent data={data} abbr={t.abbr} />
      </div>
    </div>
  );
}

// ── Mobile accordion row ──────────────────────────────────────────────
function MobileRow({ slug, data, expanded, onToggle }) {
  const t = NHL_TEAMS[slug] || { city: slug, name: "", abbr: "?" };
  return (
    <div className={`mobile-row${expanded ? " open" : ""}`}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
        <TeamLogo abbr={t.abbr} size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: P.white }}>{t.city}</div>
          <div style={{ fontSize: 10, color: P.dove }}>{t.name}</div>
        </div>
        <div style={{ fontSize: 18, color: P.dove, lineHeight: 1, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.25s" }}>▾</div>
      </div>
      <div className={`mobile-body${expanded ? " open" : ""}`}>
        <div style={{ padding: "0 16px 20px" }}>
          <LineupContent data={data} abbr={t.abbr} />
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────
export default function App() {
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const slugs = useMemo(() =>
    Object.keys(TEAMS_DATA).filter(slug => {
      if (!search.trim()) return true;
      const t = NHL_TEAMS[slug];
      return `${t?.city} ${t?.name} ${t?.abbr}`.toLowerCase().includes(search.toLowerCase());
    }), [search]);

  const toggle = (slug) => setExpanded(prev => ({ ...prev, [slug]: !prev[slug] }));

  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", background: P.bg, minHeight: "100vh", color: P.white }}>
      <style>{css}</style>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${P.border}`, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, position: "sticky", top: 0, zIndex: 50, background: P.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 6, height: 28, borderRadius: 3, background: `linear-gradient(180deg, ${P.casper}, ${P.dove})` }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: P.white, lineHeight: 1.1 }}>NHL LINE COMBOS</div>
            <div style={{ fontSize: 9, color: P.dove, letterSpacing: "0.08em" }}>UPDATED {UPDATED_AT}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!isMobile && (
            <button onClick={() => setExpanded({})} style={{ background: "none", border: `1px solid ${P.border}`, borderRadius: 4, padding: "5px 10px", color: P.dove, fontSize: 9, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.08em" }}>
              COLLAPSE ALL
            </button>
          )}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 4, padding: "6px 10px", color: P.white, fontSize: 12, fontFamily: "inherit", width: isMobile ? 120 : 150 }} />
        </div>
      </div>

      {/* Desktop */}
      {!isMobile && (
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", minHeight: "calc(100vh - 52px)" }}>
            {slugs.map(slug => (
              <TeamStrip key={slug} slug={slug} data={TEAMS_DATA[slug]} expanded={!!expanded[slug]} onToggle={() => toggle(slug)} />
            ))}
          </div>
        </div>
      )}

      {/* Mobile */}
      {isMobile && (
        <div>
          {slugs.map(slug => (
            <MobileRow key={slug} slug={slug} data={TEAMS_DATA[slug]} expanded={!!expanded[slug]} onToggle={() => toggle(slug)} />
          ))}
        </div>
      )}
    </div>
  );
}
