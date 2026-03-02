// ─── COPY BUTTON (top-right of artifact) ───
// Use the "Copy" icon in the artifact toolbar above ↑
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

// Full schedule — auto-selects today's games
const SCHEDULE_RAW = `2026-03-01	Vegas Golden Knights	Pittsburgh Penguins
2026-03-01	Chicago Blackhawks	Utah Mammoth
2026-03-01	Winnipeg Jets	San Jose Sharks
2026-03-01	St. Louis Blues	Minnesota Wild
2026-03-01	Florida Panthers	New York Islanders
2026-03-01	Calgary Flames	Anaheim Ducks
2026-03-02	Detroit Red Wings	Nashville Predators
2026-03-02	Columbus Blue Jackets	New York Rangers
2026-03-02	Philadelphia Flyers	Toronto Maple Leafs
2026-03-02	Dallas Stars	Vancouver Canucks
2026-03-02	Carolina Hurricanes	Seattle Kraken
2026-03-02	Colorado Avalanche	Los Angeles Kings
2026-03-03	Pittsburgh Penguins	Boston Bruins
2026-03-03	Vegas Golden Knights	Buffalo Sabres
2026-03-03	Florida Panthers	New Jersey Devils
2026-03-03	Utah Mammoth	Washington Capitals
2026-03-03	Nashville Predators	Columbus Blue Jackets
2026-03-03	Chicago Blackhawks	Winnipeg Jets
2026-03-03	Dallas Stars	Calgary Flames
2026-03-03	Ottawa Senators	Edmonton Oilers
2026-03-03	Tampa Bay Lightning	Minnesota Wild
2026-03-03	Colorado Avalanche	Anaheim Ducks
2026-03-03	Montreal Canadiens	San Jose Sharks
2026-03-04	Vegas Golden Knights	Detroit Red Wings
2026-03-04	Toronto Maple Leafs	New Jersey Devils
2026-03-04	Carolina Hurricanes	Vancouver Canucks
2026-03-04	New York Islanders	Anaheim Ducks
2026-03-04	St. Louis Blues	Seattle Kraken
2026-03-05	Toronto Maple Leafs	New York Rangers
2026-03-05	Utah Mammoth	Philadelphia Flyers
2026-03-05	Buffalo Sabres	Pittsburgh Penguins
2026-03-05	Florida Panthers	Columbus Blue Jackets
2026-03-05	Boston Bruins	Nashville Predators
2026-03-05	Tampa Bay Lightning	Winnipeg Jets
2026-03-05	Ottawa Senators	Calgary Flames
2026-03-05	New York Islanders	Los Angeles Kings
2026-03-06	Florida Panthers	Detroit Red Wings
2026-03-06	Colorado Avalanche	Dallas Stars
2026-03-06	Vancouver Canucks	Chicago Blackhawks
2026-03-06	Carolina Hurricanes	Edmonton Oilers
2026-03-06	Montreal Canadiens	Anaheim Ducks
2026-03-06	Minnesota Wild	Vegas Golden Knights
2026-03-06	St. Louis Blues	San Jose Sharks
2026-03-07	Washington Capitals	Boston Bruins
2026-03-07	New York Rangers	New Jersey Devils
2026-03-07	Nashville Predators	Buffalo Sabres
2026-03-07	Philadelphia Flyers	Pittsburgh Penguins
2026-03-07	Tampa Bay Lightning	Toronto Maple Leafs
2026-03-07	Utah Mammoth	Columbus Blue Jackets
2026-03-07	Vancouver Canucks	Winnipeg Jets
2026-03-07	Montreal Canadiens	Los Angeles Kings
2026-03-07	Carolina Hurricanes	Calgary Flames
2026-03-07	New York Islanders	San Jose Sharks
2026-03-07	Ottawa Senators	Seattle Kraken
2026-03-08	Minnesota Wild	Colorado Avalanche
2026-03-08	Boston Bruins	Pittsburgh Penguins
2026-03-08	Tampa Bay Lightning	Buffalo Sabres
2026-03-08	Chicago Blackhawks	Dallas Stars
2026-03-08	Detroit Red Wings	New Jersey Devils
2026-03-08	St. Louis Blues	Anaheim Ducks
2026-03-08	Edmonton Oilers	Vegas Golden Knights
2026-03-09	Los Angeles Kings	Columbus Blue Jackets
2026-03-09	New York Rangers	Philadelphia Flyers
2026-03-09	Calgary Flames	Washington Capitals
2026-03-09	Utah Mammoth	Chicago Blackhawks
2026-03-09	Ottawa Senators	Vancouver Canucks
2026-03-10	Los Angeles Kings	Boston Bruins
2026-03-10	San Jose Sharks	Buffalo Sabres
2026-03-10	Toronto Maple Leafs	Montreal Canadiens
2026-03-10	Columbus Blue Jackets	Tampa Bay Lightning
2026-03-10	Detroit Red Wings	Florida Panthers
2026-03-10	Calgary Flames	New York Rangers
2026-03-10	Pittsburgh Penguins	Carolina Hurricanes
2026-03-10	New York Islanders	St. Louis Blues
2026-03-10	Vegas Golden Knights	Dallas Stars
2026-03-10	Utah Mammoth	Minnesota Wild
2026-03-10	Anaheim Ducks	Winnipeg Jets
2026-03-10	Edmonton Oilers	Colorado Avalanche
2026-03-10	Nashville Predators	Seattle Kraken
2026-03-11	Montreal Canadiens	Ottawa Senators
2026-03-11	Washington Capitals	Philadelphia Flyers
2026-03-12	San Jose Sharks	Boston Bruins
2026-03-12	Washington Capitals	Buffalo Sabres
2026-03-12	Anaheim Ducks	Toronto Maple Leafs
2026-03-12	Detroit Red Wings	Tampa Bay Lightning
2026-03-12	Columbus Blue Jackets	Florida Panthers
2026-03-12	Calgary Flames	New Jersey Devils
2026-03-12	St. Louis Blues	Carolina Hurricanes
2026-03-12	Edmonton Oilers	Dallas Stars
2026-03-12	Philadelphia Flyers	Minnesota Wild
2026-03-12	New York Rangers	Winnipeg Jets
2026-03-12	Chicago Blackhawks	Utah Mammoth
2026-03-12	Nashville Predators	Vancouver Canucks
2026-03-12	Pittsburgh Penguins	Vegas Golden Knights
2026-03-12	Colorado Avalanche	Seattle Kraken
2026-03-13	Los Angeles Kings	New York Islanders
2026-03-13	Edmonton Oilers	St. Louis Blues
2026-03-14	Anaheim Ducks	Ottawa Senators
2026-03-14	Boston Bruins	Washington Capitals
2026-03-14	Colorado Avalanche	Winnipeg Jets
2026-03-14	New York Rangers	Minnesota Wild
2026-03-14	Toronto Maple Leafs	Buffalo Sabres
2026-03-14	San Jose Sharks	Montreal Canadiens
2026-03-14	Carolina Hurricanes	Tampa Bay Lightning
2026-03-14	Los Angeles Kings	New Jersey Devils
2026-03-14	Calgary Flames	New York Islanders
2026-03-14	Columbus Blue Jackets	Philadelphia Flyers
2026-03-14	Detroit Red Wings	Dallas Stars
2026-03-14	Pittsburgh Penguins	Utah Mammoth
2026-03-14	Seattle Kraken	Vancouver Canucks
2026-03-14	Chicago Blackhawks	Vegas Golden Knights
2026-03-15	St. Louis Blues	Winnipeg Jets
2026-03-15	San Jose Sharks	Ottawa Senators
2026-03-15	Anaheim Ducks	Montreal Canadiens
2026-03-15	Toronto Maple Leafs	Minnesota Wild
2026-03-15	Nashville Predators	Edmonton Oilers
2026-03-15	Florida Panthers	Seattle Kraken
2026-03-16	Calgary Flames	Detroit Red Wings
2026-03-16	Boston Bruins	New Jersey Devils
2026-03-16	Los Angeles Kings	New York Rangers
2026-03-16	Utah Mammoth	Dallas Stars
2026-03-16	Pittsburgh Penguins	Colorado Avalanche
2026-03-17	New York Islanders	Toronto Maple Leafs
2026-03-17	Boston Bruins	Montreal Canadiens
2026-03-17	Carolina Hurricanes	Columbus Blue Jackets
2026-03-17	Minnesota Wild	Chicago Blackhawks
2026-03-17	Nashville Predators	Winnipeg Jets
2026-03-17	San Jose Sharks	Edmonton Oilers
2026-03-17	Florida Panthers	Vancouver Canucks
2026-03-17	Buffalo Sabres	Vegas Golden Knights
2026-03-17	Tampa Bay Lightning	Seattle Kraken
2026-03-18	New Jersey Devils	New York Rangers
2026-03-18	Pittsburgh Penguins	Carolina Hurricanes
2026-03-18	Ottawa Senators	Washington Capitals
2026-03-18	Dallas Stars	Colorado Avalanche
2026-03-18	St. Louis Blues	Calgary Flames
2026-03-18	Philadelphia Flyers	Anaheim Ducks
2026-03-19	Winnipeg Jets	Boston Bruins
2026-03-19	New York Islanders	Ottawa Senators
2026-03-19	Montreal Canadiens	Detroit Red Wings
2026-03-19	New York Rangers	Columbus Blue Jackets
2026-03-19	Chicago Blackhawks	Minnesota Wild
2026-03-19	Seattle Kraken	Nashville Predators
2026-03-19	Florida Panthers	Edmonton Oilers
2026-03-19	Tampa Bay Lightning	Vancouver Canucks
2026-03-19	Utah Mammoth	Vegas Golden Knights
2026-03-19	Buffalo Sabres	San Jose Sharks
2026-03-19	Philadelphia Flyers	Los Angeles Kings
2026-03-20	Carolina Hurricanes	Toronto Maple Leafs
2026-03-20	New Jersey Devils	Washington Capitals
2026-03-20	Colorado Avalanche	Chicago Blackhawks
2026-03-20	Florida Panthers	Calgary Flames
2026-03-20	Anaheim Ducks	Utah Mammoth
2026-03-21	Winnipeg Jets	Pittsburgh Penguins
2026-03-21	Vegas Golden Knights	Nashville Predators
2026-03-21	Dallas Stars	Minnesota Wild
2026-03-21	Buffalo Sabres	Los Angeles Kings
2026-03-21	Philadelphia Flyers	San Jose Sharks
2026-03-21	Seattle Kraken	Columbus Blue Jackets
2026-03-21	New York Islanders	Montreal Canadiens
2026-03-21	Toronto Maple Leafs	Ottawa Senators
2026-03-21	St. Louis Blues	Vancouver Canucks
2026-03-21	Boston Bruins	Detroit Red Wings
2026-03-21	Tampa Bay Lightning	Edmonton Oilers
2026-03-22	Winnipeg Jets	New York Rangers
2026-03-22	Colorado Avalanche	Washington Capitals
2026-03-22	Carolina Hurricanes	Pittsburgh Penguins
2026-03-22	Nashville Predators	Chicago Blackhawks
2026-03-22	Columbus Blue Jackets	New York Islanders
2026-03-22	Vegas Golden Knights	Dallas Stars
2026-03-22	Tampa Bay Lightning	Calgary Flames
2026-03-22	Buffalo Sabres	Anaheim Ducks
2026-03-22	Los Angeles Kings	Utah Mammoth
2026-03-23	Ottawa Senators	New York Rangers
2026-03-24	Toronto Maple Leafs	Boston Bruins
2026-03-24	Carolina Hurricanes	Montreal Canadiens
2026-03-24	Ottawa Senators	Detroit Red Wings
2026-03-24	Seattle Kraken	Florida Panthers
2026-03-24	Chicago Blackhawks	New York Islanders
2026-03-24	Columbus Blue Jackets	Philadelphia Flyers
2026-03-24	Colorado Avalanche	Pittsburgh Penguins
2026-03-24	Minnesota Wild	Tampa Bay Lightning
2026-03-24	Washington Capitals	St. Louis Blues
2026-03-24	San Jose Sharks	Nashville Predators
2026-03-24	New Jersey Devils	Dallas Stars
2026-03-24	Vegas Golden Knights	Winnipeg Jets
2026-03-24	Los Angeles Kings	Calgary Flames
2026-03-24	Edmonton Oilers	Utah Mammoth
2026-03-24	Anaheim Ducks	Vancouver Canucks
2026-03-25	Boston Bruins	Buffalo Sabres
2026-03-25	New York Rangers	Toronto Maple Leafs
2026-03-26	Columbus Blue Jackets	Montreal Canadiens
2026-03-26	Pittsburgh Penguins	Ottawa Senators
2026-03-26	Seattle Kraken	Tampa Bay Lightning
2026-03-26	Minnesota Wild	Florida Panthers
2026-03-26	Dallas Stars	New York Islanders
2026-03-26	Chicago Blackhawks	Philadelphia Flyers
2026-03-26	San Jose Sharks	St. Louis Blues
2026-03-26	New Jersey Devils	Nashville Predators
2026-03-26	Colorado Avalanche	Winnipeg Jets
2026-03-26	Washington Capitals	Utah Mammoth
2026-03-26	Anaheim Ducks	Calgary Flames
2026-03-26	Edmonton Oilers	Vegas Golden Knights
2026-03-26	Los Angeles Kings	Vancouver Canucks
2026-03-27	Detroit Red Wings	Buffalo Sabres
2026-03-27	Chicago Blackhawks	New York Rangers
2026-03-28	Ottawa Senators	Tampa Bay Lightning
2026-03-28	Florida Panthers	New York Islanders
2026-03-28	Anaheim Ducks	Edmonton Oilers
2026-03-28	Minnesota Wild	Boston Bruins
2026-03-28	Dallas Stars	Pittsburgh Penguins
2026-03-28	New Jersey Devils	Carolina Hurricanes
2026-03-28	San Jose Sharks	Columbus Blue Jackets
2026-03-28	Seattle Kraken	Buffalo Sabres
2026-03-28	Toronto Maple Leafs	St. Louis Blues
2026-03-28	Montreal Canadiens	Nashville Predators
2026-03-28	Winnipeg Jets	Colorado Avalanche
2026-03-28	Philadelphia Flyers	Detroit Red Wings
2026-03-28	Utah Mammoth	Los Angeles Kings
2026-03-28	Vancouver Canucks	Calgary Flames
2026-03-28	Washington Capitals	Vegas Golden Knights
2026-03-29	Florida Panthers	New York Rangers
2026-03-29	Nashville Predators	Tampa Bay Lightning
2026-03-29	Montreal Canadiens	Carolina Hurricanes
2026-03-29	Boston Bruins	Columbus Blue Jackets
2026-03-29	Chicago Blackhawks	New Jersey Devils
2026-03-29	Dallas Stars	Philadelphia Flyers
2026-03-30	Pittsburgh Penguins	New York Islanders
2026-03-30	Calgary Flames	Colorado Avalanche
2026-03-30	Vancouver Canucks	Vegas Golden Knights
2026-03-30	Toronto Maple Leafs	Anaheim Ducks
2026-03-30	St. Louis Blues	San Jose Sharks
2026-03-31	Dallas Stars	Boston Bruins
2026-03-31	New York Islanders	Buffalo Sabres
2026-03-31	Montreal Canadiens	Tampa Bay Lightning
2026-03-31	Ottawa Senators	Florida Panthers
2026-03-31	New Jersey Devils	New York Rangers
2026-03-31	Detroit Red Wings	Pittsburgh Penguins
2026-03-31	Philadelphia Flyers	Washington Capitals
2026-03-31	Carolina Hurricanes	Columbus Blue Jackets
2026-03-31	Winnipeg Jets	Chicago Blackhawks
2026-03-31	Seattle Kraken	Edmonton Oilers
2026-04-01	Vancouver Canucks	Colorado Avalanche
2026-04-01	St. Louis Blues	Los Angeles Kings
2026-04-01	Anaheim Ducks	San Jose Sharks
2026-04-02	Buffalo Sabres	Ottawa Senators
2026-04-02	Pittsburgh Penguins	Tampa Bay Lightning
2026-04-02	Boston Bruins	Florida Panthers
2026-04-02	Montreal Canadiens	New York Rangers
2026-04-02	Detroit Red Wings	Philadelphia Flyers
2026-04-02	Columbus Blue Jackets	Carolina Hurricanes
2026-04-02	Washington Capitals	New Jersey Devils
2026-04-02	Winnipeg Jets	Dallas Stars
2026-04-02	Vancouver Canucks	Minnesota Wild
2026-04-02	Chicago Blackhawks	Edmonton Oilers
2026-04-02	Calgary Flames	Vegas Golden Knights
2026-04-02	Toronto Maple Leafs	San Jose Sharks
2026-04-02	Utah Mammoth	Seattle Kraken
2026-04-02	Nashville Predators	Los Angeles Kings
2026-04-03	Philadelphia Flyers	New York Islanders
2026-04-03	St. Louis Blues	Anaheim Ducks
2026-04-04	Detroit Red Wings	New York Rangers
2026-04-04	Minnesota Wild	Ottawa Senators
2026-04-04	Colorado Avalanche	Dallas Stars
2026-04-04	Boston Bruins	Tampa Bay Lightning
2026-04-04	Florida Panthers	Pittsburgh Penguins
2026-04-04	Montreal Canadiens	New Jersey Devils
2026-04-04	Buffalo Sabres	Washington Capitals
2026-04-04	New York Islanders	Carolina Hurricanes
2026-04-04	Winnipeg Jets	Columbus Blue Jackets
2026-04-04	Utah Mammoth	Vancouver Canucks
2026-04-04	Toronto Maple Leafs	Los Angeles Kings
2026-04-04	Vegas Golden Knights	Edmonton Oilers
2026-04-04	Calgary Flames	Anaheim Ducks
2026-04-04	Nashville Predators	San Jose Sharks
2026-04-04	Chicago Blackhawks	Seattle Kraken
2026-04-05	Minnesota Wild	Detroit Red Wings
2026-04-05	Florida Panthers	Pittsburgh Penguins
2026-04-05	Boston Bruins	Philadelphia Flyers
2026-04-05	Carolina Hurricanes	Ottawa Senators
2026-04-05	New Jersey Devils	Montreal Canadiens
2026-04-05	Washington Capitals	New York Rangers
2026-04-05	St. Louis Blues	Colorado Avalanche
2026-04-06	Tampa Bay Lightning	Buffalo Sabres
2026-04-06	Seattle Kraken	Winnipeg Jets
2026-04-06	Chicago Blackhawks	San Jose Sharks
2026-04-06	Nashville Predators	Los Angeles Kings
2026-04-07	Florida Panthers	Montreal Canadiens
2026-04-07	Tampa Bay Lightning	Ottawa Senators
2026-04-07	Columbus Blue Jackets	Detroit Red Wings
2026-04-07	Philadelphia Flyers	New Jersey Devils
2026-04-07	Boston Bruins	Carolina Hurricanes
2026-04-07	Colorado Avalanche	St. Louis Blues
2026-04-07	Calgary Flames	Dallas Stars
2026-04-07	Seattle Kraken	Minnesota Wild
2026-04-07	Edmonton Oilers	Utah Mammoth
2026-04-07	Vegas Golden Knights	Vancouver Canucks
2026-04-07	Nashville Predators	Anaheim Ducks
2026-04-08	Buffalo Sabres	New York Rangers
2026-04-08	Washington Capitals	Toronto Maple Leafs
2026-04-08	Edmonton Oilers	San Jose Sharks
2026-04-09	Toronto Maple Leafs	New York Islanders
2026-04-09	Columbus Blue Jackets	Buffalo Sabres
2026-04-09	Tampa Bay Lightning	Montreal Canadiens
2026-04-09	Florida Panthers	Ottawa Senators
2026-04-09	Philadelphia Flyers	Detroit Red Wings
2026-04-09	Pittsburgh Penguins	New Jersey Devils
2026-04-09	Winnipeg Jets	St. Louis Blues
2026-04-09	Carolina Hurricanes	Chicago Blackhawks
2026-04-09	Minnesota Wild	Dallas Stars
2026-04-09	Calgary Flames	Colorado Avalanche
2026-04-09	Nashville Predators	Utah Mammoth
2026-04-09	San Jose Sharks	Anaheim Ducks
2026-04-09	Vegas Golden Knights	Seattle Kraken
2026-04-09	Vancouver Canucks	Los Angeles Kings
2026-04-11	Tampa Bay Lightning	Boston Bruins
2026-04-11	Ottawa Senators	New York Islanders
2026-04-11	Washington Capitals	Pittsburgh Penguins
2026-04-11	Edmonton Oilers	Los Angeles Kings
2026-04-11	New Jersey Devils	Detroit Red Wings
2026-04-11	St. Louis Blues	Chicago Blackhawks
2026-04-11	Minnesota Wild	Nashville Predators
2026-04-11	New York Rangers	Dallas Stars
2026-04-11	Carolina Hurricanes	Utah Mammoth
2026-04-11	Florida Panthers	Toronto Maple Leafs
2026-04-11	Columbus Blue Jackets	Montreal Canadiens
2026-04-11	Philadelphia Flyers	Winnipeg Jets
2026-04-11	Calgary Flames	Seattle Kraken
2026-04-11	Vegas Golden Knights	Colorado Avalanche
2026-04-11	Vancouver Canucks	San Jose Sharks
2026-04-12	Pittsburgh Penguins	Washington Capitals
2026-04-12	Montreal Canadiens	New York Islanders
2026-04-12	Boston Bruins	Columbus Blue Jackets
2026-04-12	Ottawa Senators	New Jersey Devils
2026-04-12	Vancouver Canucks	Anaheim Ducks
2026-04-12	Utah Mammoth	Calgary Flames
2026-04-13	Detroit Red Wings	Tampa Bay Lightning
2026-04-13	New York Rangers	Florida Panthers
2026-04-13	Carolina Hurricanes	Philadelphia Flyers
2026-04-13	Dallas Stars	Toronto Maple Leafs
2026-04-13	Minnesota Wild	St. Louis Blues
2026-04-13	San Jose Sharks	Nashville Predators
2026-04-13	Buffalo Sabres	Chicago Blackhawks
2026-04-13	Colorado Avalanche	Edmonton Oilers
2026-04-13	Los Angeles Kings	Seattle Kraken
2026-04-13	Winnipeg Jets	Vegas Golden Knights
2026-04-14	New Jersey Devils	Boston Bruins
2026-04-14	Carolina Hurricanes	New York Islanders
2026-04-14	Montreal Canadiens	Philadelphia Flyers
2026-04-14	Washington Capitals	Columbus Blue Jackets
2026-04-14	Anaheim Ducks	Minnesota Wild
2026-04-14	Winnipeg Jets	Utah Mammoth
2026-04-14	Colorado Avalanche	Calgary Flames
2026-04-14	Pittsburgh Penguins	St. Louis Blues
2026-04-14	Los Angeles Kings	Vancouver Canucks
2026-04-15	Dallas Stars	Buffalo Sabres
2026-04-15	New York Rangers	Tampa Bay Lightning
2026-04-15	Detroit Red Wings	Florida Panthers
2026-04-15	Toronto Maple Leafs	Ottawa Senators
2026-04-15	San Jose Sharks	Chicago Blackhawks
2026-04-15	Seattle Kraken	Vegas Golden Knights
2026-04-16	Anaheim Ducks	Nashville Predators
2026-04-16	San Jose Sharks	Winnipeg Jets
2026-04-16	St. Louis Blues	Utah Mammoth
2026-04-16	Los Angeles Kings	Calgary Flames
2026-04-16	Vancouver Canucks	Edmonton Oilers
2026-04-16	Seattle Kraken	Colorado Avalanche`;

// Name → slug map
const NAME_TO_SLUG = Object.fromEntries(
  Object.entries(NHL_TEAMS).map(([slug, t]) => [`${t.city} ${t.name}`, slug])
);
// Manual overrides for names that don't match city+name pattern
const NAME_OVERRIDES = {
  "Vegas Golden Knights": "vegas-golden-knights",
  "Utah Mammoth": "utah-mammoth",
  "NY Rangers": "new-york-rangers",
  "NY Islanders": "new-york-islanders",
};

function nameToSlug(name) {
  if (NAME_OVERRIDES[name]) return NAME_OVERRIDES[name];
  // Try direct match against slug names
  const found = Object.entries(NHL_TEAMS).find(([, t]) =>
    `${t.city} ${t.name}`.toLowerCase() === name.toLowerCase() ||
    name.toLowerCase().includes(t.name.toLowerCase())
  );
  return found ? found[0] : null;
}

function getTodayGames() {
  const today = new Date();
  const pad = n => String(n).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const games = [];
  for (const line of SCHEDULE_RAW.trim().split("\n")) {
    const [date, away, home] = line.split("\t");
    if (date === todayStr) {
      const awaySlug = nameToSlug(away);
      const homeSlug = nameToSlug(home);
      if (awaySlug && homeSlug) games.push({ away: awaySlug, home: homeSlug });
    }
  }
  return games;
}

const P = {
  bg: "#0d0d0d", surface: "#161616", border: "#252525",
  dove: "#686B6C", casper: "#B8C4CA", white: "#F0F0F0", dim: "#3a3a3a",
  hover: "#1a2530", active: "#1e2d3d", accent: "#2a4a6b",
};

const LOGO_URL = (abbr) => `https://assets.nhle.com/logos/nhl/svg/${abbr}_dark.svg`;
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
  .mobile-row { border-bottom: 1px solid ${P.border}; background: ${P.surface}; cursor: pointer; transition: background 0.15s; }
  .mobile-row:hover { background: ${P.hover}; }
  .mobile-row.open { background: ${P.active}; }
  .mobile-body { overflow: hidden; max-height: 0; transition: max-height 0.35s cubic-bezier(0.4,0,0.2,1); }
  .mobile-body.open { max-height: 2000px; }
  .tab-btn { background: none; border: none; cursor: pointer; font-family: inherit; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; padding: 0 16px; height: 100%; transition: color 0.15s, border-bottom 0.15s; border-bottom: 2px solid transparent; }
  .tab-btn.active { color: ${P.white}; border-bottom-color: ${P.casper}; }
  .tab-btn:not(.active) { color: ${P.dove}; }
  .tab-btn:not(.active):hover { color: ${P.casper}; }
  .compare-chip { display: flex; align-items: center; gap: 6px; background: ${P.surface}; border: 1px solid ${P.border}; border-radius: 20px; padding: 4px 10px 4px 6px; cursor: pointer; transition: border-color 0.15s; }
  .compare-chip:hover { border-color: ${P.dove}; }
  .compare-chip.selected { border-color: ${P.casper}; background: ${P.active}; }
  .rm-btn { background: none; border: none; cursor: pointer; color: ${P.dove}; font-size: 14px; line-height: 1; padding: 0 0 0 4px; }
  .rm-btn:hover { color: ${P.white}; }
`;

function SiteLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <path d="M34 18 Q60 42 86 18" stroke={P.casper} strokeWidth="1.2" fill="none" opacity="0.7" transform="rotate(180,60,27)"/>
      <path d="M34 21 Q60 43 86 21" stroke={P.dove} strokeWidth="0.45" fill="none" opacity="0.4" transform="rotate(180,60,27)"/>
      <path d="M35 25 Q60 44 85 25" stroke={P.dove} strokeWidth="0.45" fill="none" opacity="0.35" transform="rotate(180,60,27)"/>
      <path d="M36 29 Q60 44 84 29" stroke={P.dove} strokeWidth="0.45" fill="none" opacity="0.3" transform="rotate(180,60,27)"/>
      <path d="M38 33 Q60 44 82 33" stroke={P.dove} strokeWidth="0.45" fill="none" opacity="0.25" transform="rotate(180,60,27)"/>
      <path d="M41 37 Q60 44 79 37" stroke={P.dove} strokeWidth="0.45" fill="none" opacity="0.2" transform="rotate(180,60,27)"/>
      <line x1="44" y1="12" x2="42" y2="38" stroke={P.dove} strokeWidth="0.45" opacity="0.35" transform="rotate(180,60,27)"/>
      <line x1="52" y1="12" x2="51" y2="41" stroke={P.dove} strokeWidth="0.45" opacity="0.35" transform="rotate(180,60,27)"/>
      <line x1="60" y1="12" x2="60" y2="42" stroke={P.dove} strokeWidth="0.45" opacity="0.35" transform="rotate(180,60,27)"/>
      <line x1="68" y1="12" x2="69" y2="41" stroke={P.dove} strokeWidth="0.45" opacity="0.35" transform="rotate(180,60,27)"/>
      <line x1="76" y1="12" x2="78" y2="38" stroke={P.dove} strokeWidth="0.45" opacity="0.35" transform="rotate(180,60,27)"/>
      <line x1="60" y1="12" x2="60" y2="18" stroke={P.casper} strokeWidth="0.8" opacity="0.5" transform="rotate(180,60,27)"/>
      <line x1="34" y1="12" x2="86" y2="12" stroke={P.casper} strokeWidth="1.2" opacity="0.7" transform="rotate(180,60,27)"/>
      <line x1="34" y1="12" x2="34" y2="18" stroke={P.casper} strokeWidth="1.2" opacity="0.7" transform="rotate(180,60,27)"/>
      <line x1="86" y1="12" x2="86" y2="18" stroke={P.casper} strokeWidth="1.2" opacity="0.7" transform="rotate(180,60,27)"/>
      <ellipse cx="60" cy="28" rx="10" ry="6" fill={P.casper} opacity="0.08"/>
      <ellipse cx="60" cy="28" rx="8" ry="4.5" fill={P.dim} stroke={P.casper} strokeWidth="1"/>
      <ellipse cx="60" cy="27" rx="7" ry="3.5" fill="#222" stroke={P.dove} strokeWidth="0.5"/>
      <ellipse cx="57" cy="26" rx="2.5" ry="1.2" fill={P.casper} opacity="0.12"/>
      <path d="M60 33 Q61 40 60 48" stroke={P.casper} strokeWidth="0.9" strokeLinecap="round" opacity="0.5"/>
      <circle cx="60" cy="49" r="1.5" fill={P.casper} opacity="0.35"/>
      <line x1="8" y1="62" x2="105" y2="62" stroke={P.dove} strokeWidth="1.5" strokeDasharray="5 5" strokeLinecap="round"/>
      <line x1="8" y1="75" x2="105" y2="75" stroke={P.white} strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="8" y1="88" x2="105" y2="88" stroke={P.dove} strokeWidth="1.5" strokeDasharray="5 5" strokeLinecap="round"/>
      <circle cx="62" cy="62" r="3.5" fill={P.surface} stroke={P.dove} strokeWidth="1.2"/>
      <circle cx="62" cy="75" r="5" fill={P.surface} stroke={P.casper} strokeWidth="1.5"/>
      <circle cx="62" cy="88" r="3.5" fill={P.surface} stroke={P.dove} strokeWidth="1.2"/>
      <line x1="62" y1="65.5" x2="62" y2="70" stroke={P.dim} strokeWidth="0.8"/>
      <line x1="62" y1="80" x2="62" y2="84.5" stroke={P.dim} strokeWidth="0.8"/>
    </svg>
  );
}

function TeamLogo({ abbr, size = 48 }) {
  const [err, setErr] = useState(false);
  if (err) return <div style={{ width: size, height: size, borderRadius: 6, background: P.dim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.22, fontWeight: 800, color: P.white, flexShrink: 0 }}>{abbr}</div>;
  return <img src={LOGO_URL(abbr)} alt={abbr} width={size} height={size} onError={() => setErr(true)} style={{ objectFit: "contain", flexShrink: 0 }} />;
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
      <div style={{ display: "flex", gap: 4 }}>{line.map((p, i) => <PlayerCard key={i} name={p} pos={pos[i]} />)}</div>
    </div>
  );
}

function DefensePair({ pair, pairNum }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: P.dove, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 5 }}>PAIR {pairNum}</div>
      <div style={{ display: "flex", gap: 4 }}>{pair.map((p, i) => <PlayerCard key={i} name={p} pos={i === 0 ? "LD" : "RD"} />)}</div>
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

function LineupContent({ data }) {
  const fwd = data.forwards || [], def = data.defense || [], gol = data.goalies || [];
  return (
    <>
      <Divider label="FORWARDS" />
      {fwd.map((line, i) => <ForwardLine key={i} line={line} lineNum={i + 1} />)}
      <Divider label="DEFENSE" />
      {def.map((pair, i) => <DefensePair key={i} pair={pair} pairNum={i + 1} />)}
      {gol.length > 0 && (<><Divider label="GOALIES" /><div style={{ display: "flex", gap: 4 }}>{gol.map((g, i) => <PlayerCard key={i} name={g[0]} pos={i === 0 ? "STR" : "BKP"} />)}</div></>)}
    </>
  );
}

// ── ALL TEAMS view ────────────────────────────────────────────────────
function TeamStrip({ slug, data, expanded, onToggle }) {
  const t = NHL_TEAMS[slug] || { city: slug, name: "", abbr: "?" };
  return (
    <div className={`strip${expanded ? " expanded" : ""}`} onClick={onToggle}>
      <div style={{ position: "absolute", top: 0, left: 0, width: COLLAPSED_W, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, opacity: expanded ? 0 : 1, transition: "opacity 0.15s", pointerEvents: "none", padding: "0 10px" }}>
        <TeamLogo abbr={t.abbr} size={52} />
        <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 10, fontWeight: 600, color: P.casper, letterSpacing: "0.14em", whiteSpace: "nowrap" }}>{t.city.toUpperCase()}</div>
      </div>
      <div style={{ opacity: expanded ? 1 : 0, transition: "opacity 0.2s 0.15s", padding: "18px 16px", minWidth: EXPANDED_W, pointerEvents: expanded ? "auto" : "none", overflowY: "auto", maxHeight: "calc(100vh - 88px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 14, borderBottom: `1px solid ${P.border}` }}>
          <TeamLogo abbr={t.abbr} size={48} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: P.white, lineHeight: 1.1 }}>{t.city}</div>
            <div style={{ fontSize: 11, color: P.dove, marginTop: 2 }}>{t.name}</div>
          </div>
        </div>
        <LineupContent data={data} />
      </div>
    </div>
  );
}

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
        <div style={{ padding: "0 16px 20px" }}><LineupContent data={data} /></div>
      </div>
    </div>
  );
}

// ── COMPARE view ──────────────────────────────────────────────────────
function CompareView({ isMobile }) {
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");

  const toggle = (slug) => {
    setSelected(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]);
  };

  const filteredSlugs = useMemo(() => Object.keys(NHL_TEAMS).filter(slug => {
    const t = NHL_TEAMS[slug];
    return `${t.city} ${t.name} ${t.abbr}`.toLowerCase().includes(search.toLowerCase());
  }), [search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 88px)" }}>
      {/* Team picker */}
      <div style={{ borderBottom: `1px solid ${P.border}`, padding: "12px 16px", background: P.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter teams..."
            style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 4, padding: "5px 10px", color: P.white, fontSize: 12, fontFamily: "inherit", width: 160 }} />
          {selected.length > 0 && (
            <button onClick={() => setSelected([])} style={{ background: "none", border: `1px solid ${P.border}`, borderRadius: 4, padding: "5px 10px", color: P.dove, fontSize: 9, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.08em" }}>
              CLEAR ALL
            </button>
          )}
          <span style={{ fontSize: 10, color: P.dove, marginLeft: "auto" }}>{selected.length} selected</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {filteredSlugs.map(slug => {
            const t = NHL_TEAMS[slug];
            const isSel = selected.includes(slug);
            return (
              <div key={slug} className={`compare-chip${isSel ? " selected" : ""}`} onClick={() => toggle(slug)}>
                <TeamLogo abbr={t.abbr} size={20} />
                <span style={{ fontSize: 11, fontWeight: 600, color: isSel ? P.white : P.casper, whiteSpace: "nowrap" }}>{t.abbr}</span>
                {isSel && <button className="rm-btn" onClick={e => { e.stopPropagation(); toggle(slug); }}>×</button>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Side-by-side lineups */}
      {selected.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 28, opacity: 0.15 }}>⬆</span>
          <span style={{ fontSize: 12, color: P.dove, letterSpacing: "0.1em" }}>SELECT TEAMS ABOVE TO COMPARE</span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden" }}>
          <div style={{ display: "flex", height: "100%", minWidth: selected.length * (EXPANDED_W + 1) }}>
            {selected.map((slug, i) => {
              const t = NHL_TEAMS[slug];
              const data = TEAMS_DATA[slug];
              return (
                <div key={slug} style={{ width: EXPANDED_W, flexShrink: 0, borderRight: i < selected.length - 1 ? `1px solid ${P.border}` : "none", display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "14px 16px", borderBottom: `1px solid ${P.border}`, display: "flex", alignItems: "center", gap: 10, background: P.surface, position: "sticky", top: 0 }}>
                    <TeamLogo abbr={t.abbr} size={40} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: P.white }}>{t.city}</div>
                      <div style={{ fontSize: 10, color: P.dove }}>{t.name}</div>
                    </div>
                    <button className="rm-btn" style={{ marginLeft: "auto", fontSize: 18 }} onClick={() => toggle(slug)}>×</button>
                  </div>
                  <div style={{ overflowY: "auto", flex: 1, padding: "0 16px 20px" }}>
                    <LineupContent data={data} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TODAY view ────────────────────────────────────────────────────────
function TodayView({ isMobile }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (slug) => setExpanded(prev => ({ ...prev, [slug]: !prev[slug] }));

  const TODAY_GAMES = useMemo(() => getTodayGames(), []);
  const todaySlugs = useMemo(() => {
    const slugs = [];
    TODAY_GAMES.forEach(g => { slugs.push(g.away); slugs.push(g.home); });
    return slugs;
  }, [TODAY_GAMES]);

  if (isMobile) {
    return (
      <div>
        {TODAY_GAMES.map((g, i) => {
          const away = NHL_TEAMS[g.away], home = NHL_TEAMS[g.home];
          return (
            <div key={i}>
              {/* Matchup header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "10px 16px", background: P.dim + "33", borderBottom: `1px solid ${P.border}` }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: P.dove }}>{away?.abbr}</span>
                <span style={{ fontSize: 9, color: P.dim }}>@</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: P.dove }}>{home?.abbr}</span>
              </div>
              {[g.away, g.home].map(slug => (
                <MobileRow key={slug} slug={slug} data={TEAMS_DATA[slug]} expanded={!!expanded[slug]} onToggle={() => toggle(slug)} />
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      {/* Matchup headers */}
      <div style={{ display: "flex", borderBottom: `1px solid ${P.border}`, background: P.surface, position: "sticky", top: 0, zIndex: 10, minWidth: todaySlugs.length * COLLAPSED_W }}>
        {TODAY_GAMES.map((g, i) => (
          <div key={i} style={{ display: "flex", width: COLLAPSED_W * 2, flexShrink: 0, alignItems: "center", justifyContent: "center", gap: 8, padding: "6px 0", borderRight: `1px solid ${P.border}` }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: P.dove }}>{NHL_TEAMS[g.away]?.abbr}</span>
            <span style={{ fontSize: 8, color: P.dim }}>@</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: P.dove }}>{NHL_TEAMS[g.home]?.abbr}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "stretch", minHeight: "calc(100vh - 124px)" }}>
        {todaySlugs.map(slug => (
          <TeamStrip key={slug} slug={slug} data={TEAMS_DATA[slug]} expanded={!!expanded[slug]} onToggle={() => toggle(slug)} />
        ))}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("all"); // "all" | "today" | "compare"
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
          <SiteLogo size={36} />
          <div style={{ width: 1, height: 30, background: P.border }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: P.white, lineHeight: 1.1 }}>NHL LINE COMBOS</div>
            <div style={{ fontSize: 9, color: P.dove, letterSpacing: "0.08em" }}>UPDATED {UPDATED_AT}</div>
          </div>
        </div>
        {tab === "all" && (
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 4, padding: "6px 10px", color: P.white, fontSize: 12, fontFamily: "inherit", width: isMobile ? 110 : 150 }} />
        )}
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom: `1px solid ${P.border}`, display: "flex", height: 36, position: "sticky", top: 52, zIndex: 49, background: P.bg }}>
        {["all","today","compare"].map(t => (
          <button key={t} className={`tab-btn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t === "all" ? "ALL TEAMS" : t === "today" ? "TODAY" : "COMPARE"}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "all" && !isMobile && (
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", minHeight: "calc(100vh - 88px)" }}>
            {slugs.map(slug => <TeamStrip key={slug} slug={slug} data={TEAMS_DATA[slug]} expanded={!!expanded[slug]} onToggle={() => toggle(slug)} />)}
          </div>
        </div>
      )}
      {tab === "all" && isMobile && (
        <div>{slugs.map(slug => <MobileRow key={slug} slug={slug} data={TEAMS_DATA[slug]} expanded={!!expanded[slug]} onToggle={() => toggle(slug)} />)}</div>
      )}
      {tab === "today" && <TodayView isMobile={isMobile} />}
      {tab === "compare" && <CompareView isMobile={isMobile} />}
    </div>
  );
}
