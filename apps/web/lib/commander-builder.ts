import { pool, type PoolClient } from "@cyberscry/database";
import { findScryfallCard, searchScryfall, type ScryfallCard } from "@/lib/mtg";
import { askDeckAssistant } from "@/lib/deck-assistant";

function imageUrl(card: ScryfallCard) {
  return card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null;
}

function themeQuery(card: ScryfallCard) {
  const text = card.oracle_text?.toLowerCase() ?? "";
  const themes: string[] = [];
  if (text.includes("draw")) themes.push("o:draw");
  if (text.includes("discard")) themes.push("o:discard");
  if (text.includes("graveyard")) themes.push("o:graveyard");
  if (text.includes("artifact")) themes.push("t:artifact");
  if (text.includes("enchantment")) themes.push("t:enchantment");
  if (text.includes("counter")) themes.push("o:counter");
  if (text.includes("token")) themes.push("o:token");
  if (text.includes("combat damage")) themes.push('o:"combat damage"');
  return themes.length ? `(${themes.slice(0, 3).join(" OR ")})` : "(t:creature OR t:artifact)";
}

function dedupe(cards: ScryfallCard[], excludedName: string) {
  const seen = new Set([excludedName.toLowerCase()]);
  return cards.filter(card => {
    const key = card.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function saveCard(client: PoolClient, card: ScryfallCard) {
  const owned = await client.query<{ id: string }>(
    `SELECT c.id FROM cards c JOIN collection_items ci ON ci.card_id=c.id
     WHERE lower(c.name)=lower($1) AND ci.quantity>0 ORDER BY ci.quantity DESC,c.updated_at DESC LIMIT 1`,
    [card.name],
  );
  if (owned.rows[0]) {
    const ownedPrice = card.prices?.usd ? Math.round(Number(card.prices.usd) * 100) : null;
    await client.query(
      `UPDATE cards SET image_url=coalesce(image_url,$2),oracle_text=coalesce($3,oracle_text),price_usd_cents=coalesce($4,price_usd_cents),mana_cost=coalesce($5,mana_cost),mana_value=coalesce($6,mana_value),type_line=coalesce($7,type_line),colors=$8,color_identity=$9,price_checked_at=now(),commander_legal=$10,updated_at=now() WHERE id=$1`,
      [owned.rows[0].id,imageUrl(card),card.oracle_text??null,ownedPrice,card.mana_cost??null,card.cmc??null,card.type_line??null,card.colors??[],card.color_identity,card.legalities?.commander === "legal"],
    );
    return owned.rows[0].id;
  }
  const price = card.prices?.usd ? Math.round(Number(card.prices.usd) * 100) : null;
  const saved = await client.query<{ id: string }>(
    `INSERT INTO cards (external_id,name,set_code,set_name,collector_number,mana_cost,mana_value,type_line,oracle_text,colors,color_identity,rarity,image_url,commander_legal,price_usd_cents,price_checked_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now())
     ON CONFLICT (external_id) DO UPDATE SET price_usd_cents=EXCLUDED.price_usd_cents,price_checked_at=now(),image_url=EXCLUDED.image_url,oracle_text=EXCLUDED.oracle_text,updated_at=now()
     RETURNING id`,
    [`scryfall:${card.id}`,card.name,card.set.toUpperCase(),card.set_name,card.collector_number??null,card.mana_cost??null,card.cmc??null,card.type_line??"",card.oracle_text??null,card.colors??[],card.color_identity,card.rarity??null,imageUrl(card),card.legalities?.commander === "legal",price],
  );
  return saved.rows[0].id;
}

function priceCents(card:ScryfallCard){return card.prices?.usd?Math.round(Number(card.prices.usd)*100):0;}

export async function createCommanderDeck(input: { name: string; commanderName: string; commanderId:string; budgetCents: number | null; theme:string|null; colors:string[] }) {
  const commander = await findScryfallCard(input.commanderId);
  const canLead = commander.type_line?.includes("Legendary Creature") || commander.oracle_text?.toLowerCase().includes("can be your commander");
  if (commander.name !== input.commanderName || commander.legalities?.commander !== "legal" || !canLead) throw new Error("The selected card is not a valid Commander.");
  const invalidColors = input.colors.filter(color => !commander.color_identity.includes(color));
  if (invalidColors.length) throw new Error("The selected colors must stay within the commander's color identity.");
  const buildIdentity = input.colors.length ? input.colors : commander.color_identity;
  const identity = buildIdentity.length ? buildIdentity.join("") : "C";
  const identityFilter = identity === "C" ? "id=c" : `id<=${identity}`;
  const base = `f:commander ${identityFilter} -is:funny`;
  const [themed, staples, lands, ownedRows] = await Promise.all([
    searchScryfall(`${base} -t:land ${themeQuery(commander)}`, 100),
    searchScryfall(`${base} -t:land`, 100),
    searchScryfall(`${base} t:land -t:basic`, 80),
    pool.query<{external_id:string;name:string;set_code:string;set_name:string;mana_cost:string|null;mana_value:number|null;type_line:string;oracle_text:string|null;colors:string[];color_identity:string[];rarity:string|null;image_url:string|null;price_usd_cents:number|null}>(`SELECT DISTINCT ON (lower(c.name)) c.external_id,c.name,c.set_code,c.set_name,c.mana_cost,c.mana_value,c.type_line,c.oracle_text,c.colors,c.color_identity,c.rarity,c.image_url,c.price_usd_cents FROM collection_items ci JOIN cards c ON c.id=ci.card_id WHERE ci.quantity>0 AND c.commander_legal AND c.color_identity<@$1::text[] AND c.type_line NOT LIKE '%Land%' ORDER BY lower(c.name),ci.quantity DESC`,[buildIdentity]),
  ]);
  const ownedNames=new Set(ownedRows.rows.map(row=>row.name.toLowerCase()));
  const ownedCandidates:ScryfallCard[]=ownedRows.rows.map(card=>({id:card.external_id.replace(/^scryfall:/,""),name:card.name,set:card.set_code.toLowerCase(),set_name:card.set_name,mana_cost:card.mana_cost??undefined,cmc:card.mana_value==null?undefined:Number(card.mana_value),colors:card.colors,color_identity:card.color_identity,rarity:card.rarity??undefined,prices:{usd:card.price_usd_cents==null?null:(card.price_usd_cents/100).toFixed(2)},legalities:{commander:"legal"},oracle_text:card.oracle_text??undefined,type_line:card.type_line,image_uris:card.image_url?{normal:card.image_url}:undefined}));
  const spellCandidates = dedupe([...themed,...staples,...ownedCandidates], commander.name).filter(card=>!card.type_line?.includes("Land"));
  let assistantSummary:string|null=null;
  let assistantUsed=false;
  let spells=spellCandidates.slice(0,63);
  try {
    const plan=await askDeckAssistant({format:"commander",commander,candidates:spellCandidates,ownedNames,budgetCents:input.budgetCents,theme:input.theme,colors:input.colors,targetNonlandCount:63});
    if(plan){const byName=new Map(spellCandidates.map(card=>[card.name.toLowerCase(),card]));const selected:ScryfallCard[]=[];const seen=new Set<string>();for(const name of plan.cardNames){const card=byName.get(name.toLowerCase());if(card&&!seen.has(card.name.toLowerCase())){selected.push(card);seen.add(card.name.toLowerCase());}}for(const card of spellCandidates){if(selected.length>=63)break;if(!seen.has(card.name.toLowerCase())){selected.push(card);seen.add(card.name.toLowerCase());}}spells=selected.slice(0,63);assistantSummary=plan.summary.slice(0,700);assistantUsed=true;}
  } catch(error) {
    console.error("Deck assistant fallback:",error instanceof Error?error.message:error);
  }
  let nonbasics=dedupe(lands,commander.name);
  if(input.budgetCents!=null)nonbasics=nonbasics.toSorted((left,right)=>Number(!ownedNames.has(left.name.toLowerCase()))-Number(!ownedNames.has(right.name.toLowerCase()))||priceCents(left)-priceCents(right));
  nonbasics=nonbasics.slice(0,20);
  const basicsByColor: Record<string, string> = { W:"Plains", U:"Island", B:"Swamp", R:"Mountain", G:"Forest", C:"Wastes" };
  const basicNames = (commander.color_identity.length ? commander.color_identity : ["C"]).map(color => basicsByColor[color]);
  const basicCards = await Promise.all(basicNames.map(name => searchScryfall(`!"${name}"`, 1).then(cards => cards[0])));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const commanderId = await saveCard(client, commander);
    const description=assistantUsed?`AI-assisted build around ${commander.name}. ${assistantSummary}`:`Generated around ${commander.name} using the local Scryfall fallback.`;
    const deck = await client.query<{ id:string }>("INSERT INTO decks (name,format,target_budget_cents,commander_card_id,description) VALUES ($1,'commander',$2,$3,$4) RETURNING id",[input.name,input.budgetCents,commanderId,description]);
    await client.query("INSERT INTO deck_cards (deck_id,card_id,quantity,section) VALUES ($1,$2,1,'commander')",[deck.rows[0].id,commanderId]);
    for (const card of [...spells, ...nonbasics]) {
      const cardId = await saveCard(client, card);
      await client.query("INSERT INTO deck_cards (deck_id,card_id,quantity,section) VALUES ($1,$2,1,'mainboard') ON CONFLICT DO NOTHING",[deck.rows[0].id,cardId]);
    }
    const basicTotal = 99 - spells.length - nonbasics.length;
    for (let index=0; index<basicCards.length; index++) {
      const card = basicCards[index];
      if (!card) continue;
      const quantity = Math.floor(basicTotal/basicCards.length) + (index < basicTotal%basicCards.length ? 1 : 0);
      const cardId = await saveCard(client, card);
      await client.query("INSERT INTO deck_cards (deck_id,card_id,quantity,section) VALUES ($1,$2,$3,'mainboard') ON CONFLICT DO NOTHING",[deck.rows[0].id,cardId,quantity]);
    }
    await client.query("COMMIT");
    return deck.rows[0].id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
