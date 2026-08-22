export const modes = {
  normal: {
    name: "Normal",
    description: "Find 3 cards that form a Set.",
    setType: "Set",
  },
  setjr: {
    name: "Junior",
    description:
      "A simplified version that only uses cards with solid shading.",
    setType: "Set",
  },
  setchain: {
    name: "Set-Chain",
    description: "In every Set, you have to use 1 card from the previous Set.",
    setType: "Set",
  },
  ultraset: {
    name: "UltraSet",
    description:
      "Find 4 cards such that the first pair and the second pair form a Set with the same additional card.",
    setType: "UltraSet",
  },
};

export const standardLayouts = {
  QWERTY: {
    verticalLayout: "123qweasdzxcrtyfghvbnuiojkl",
    horizontalLayout: "qazwsxedcrfvtgbyhnujmik,ol.",
    orientationChangeKey: ";",
    layoutChangeKey: "'",
  },
  AZERTY: {
    verticalLayout: '&é"azeqsdwxcrtyfghvbnuiojkl',
    horizontalLayout: "aqwzsxedcrfvtgbyhnuj,ik;ol:",
    orientationChangeKey: "m",
    layoutChangeKey: "ù",
  },
  QWERTZ: {
    verticalLayout: "123qweasdyxcrtzfghvbnuiojkl",
    horizontalLayout: "qaywsxedcrfvtgbzhnujmik,ol.",
    orientationChangeKey: "p",
    layoutChangeKey: "-",
  },
  Dvorak: {
    verticalLayout: "123',.aoe;qjpyfuidkxbgcrhtn",
    horizontalLayout: "'a;,oq.ejpukyixfdbghmctwrnv",
    orientationChangeKey: "s",
    layoutChangeKey: "-",
  },
  Colemak: {
    verticalLayout: "123qwfarszxcpgjtdhvbkluynei",
    horizontalLayout: "qazwrxfscptvgdbjhklnmue,yi.",
    orientationChangeKey: "o",
    layoutChangeKey: "'",
  },
  Workman: {
    verticalLayout: "123qdrashzxmwbjtgycvkfupneo",
    horizontalLayout: "qazdsxrhmwtcbgvjykfnlue,po.",
    orientationChangeKey: "i",
    layoutChangeKey: "'",
  },
};

export function generateCards() {
  const deck = [];
  for (let color = 0; color < 3; color += 1) {
    for (let shape = 0; shape < 3; shape += 1) {
      for (let shade = 0; shade < 3; shade += 1) {
        for (let number = 0; number < 3; number += 1) {
          deck.push(`${color}${shape}${shade}${number}`);
        }
      }
    }
  }
  return deck;
}

export function checkSet(a, b, c) {
  for (let i = 0; i < 4; i += 1) {
    if ((a.charCodeAt(i) + b.charCodeAt(i) + c.charCodeAt(i)) % 3 !== 0) {
      return false;
    }
  }
  return true;
}

export function conjugateCard(a, b) {
  const zeroCode = "0".charCodeAt(0);
  let card = "";
  for (let i = 0; i < 4; i += 1) {
    const sum = a.charCodeAt(i) - zeroCode + b.charCodeAt(i) - zeroCode;
    card += String.fromCharCode(zeroCode + ((3 - (sum % 3)) % 3));
  }
  return card;
}

export function checkSetUltra(a, b, c, d) {
  if (conjugateCard(a, b) === conjugateCard(c, d)) return [a, b, c, d];
  if (conjugateCard(a, c) === conjugateCard(b, d)) return [a, c, b, d];
  if (conjugateCard(a, d) === conjugateCard(b, c)) return [a, d, b, c];
  return null;
}

export function findSet(deck, gameMode = "normal", old = []) {
  const deckSet = new Set(deck);
  const ultraConjugates = {};
  for (let i = 0; i < deck.length; i += 1) {
    for (let j = i + 1; j < deck.length; j += 1) {
      const conjugate = conjugateCard(deck[i], deck[j]);
      if (
        gameMode === "normal" ||
        gameMode === "setjr" ||
        (gameMode === "setchain" && old.length === 0)
      ) {
        if (deckSet.has(conjugate)) return [deck[i], deck[j], conjugate];
      } else if (gameMode === "setchain") {
        if (old.includes(conjugate)) return [conjugate, deck[i], deck[j]];
      } else if (gameMode === "ultraset") {
        if (conjugate in ultraConjugates) {
          return [...ultraConjugates[conjugate], deck[i], deck[j]];
        }
        ultraConjugates[conjugate] = [deck[i], deck[j]];
      }
    }
  }
  return null;
}

function splitDeck(deck, gameMode = "normal", minBoardSize = 12, old = []) {
  let length = Math.min(deck.length, minBoardSize);
  while (
    length < deck.length &&
    !findSet(deck.slice(0, length), gameMode, old)
  ) {
    length += 3 - (length % 3);
  }
  return deck.slice(0, length);
}

export function removeCard(deck, card) {
  const index = deck.indexOf(card);
  return [...deck.slice(0, index), ...deck.slice(index + 1)];
}

function hasDuplicates(used, cards) {
  for (let i = 0; i < cards.length; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      if (cards[i] === cards[j]) return true;
    }
    if (used[cards[i]]) return true;
  }
  return false;
}

function removeCards(state, cards) {
  const { current, used } = state;
  let canPreservePositions = current.length >= 12 + cards.length;
  for (const card of cards) {
    if (current.indexOf(card) >= 12) canPreservePositions = false;
    used[card] = true;
  }

  if (canPreservePositions) {
    const replacements = current.splice(12, cards.length);
    cards.forEach((card, index) => {
      current[current.indexOf(card)] = replacements[index];
    });
  } else {
    cards.forEach((card) => current.splice(current.indexOf(card), 1));
  }
}

function recordValidEvent(state, event, cards) {
  state.scores[event.user] = (state.scores[event.user] || 0) + 1;
  state.history.push(event);
  removeCards(state, cards);
}

function processNormal(state, event) {
  const cards = [event.c1, event.c2, event.c3];
  if (hasDuplicates(state.used, cards)) return;
  recordValidEvent(state, event, cards);
  const minSize = Math.max(state.boardSize - 3, 12);
  state.boardSize = splitDeck(state.current, "normal", minSize).length;
}

function processChain(state, event) {
  const { c1, c2, c3 } = event;
  const isFirstSet = state.history.length === 0;
  let valid =
    c1 !== c2 && c2 !== c3 && c1 !== c3 && !state.used[c2] && !state.used[c3];
  if (state.history.length) {
    const previous = state.history[state.history.length - 1];
    valid &&= [previous.c1, previous.c2, previous.c3].includes(c1);
  } else {
    valid &&= !state.used[c1];
  }
  if (!valid) return;

  recordValidEvent(
    state,
    event,
    isFirstSet ? [c1, c2, c3] : [c2, c3],
  );
  const minSize = Math.max(state.boardSize - (isFirstSet ? 3 : 2), 12);
  state.boardSize = splitDeck(
    state.current,
    "setchain",
    minSize,
    [c1, c2, c3],
  ).length;
}

function processUltra(state, event) {
  const cards = [event.c1, event.c2, event.c3, event.c4];
  if (hasDuplicates(state.used, cards)) return;
  recordValidEvent(state, event, cards);
  state.boardSize = splitDeck(
    state.current,
    "ultraset",
    Math.max(state.boardSize - 4, 12),
  ).length;
}

export function initializeDeck(deck, gameMode) {
  return gameMode === "setjr"
    ? deck.filter((card) => card[2] === "0")
    : deck.slice();
}

export function computeState(gameData, gameMode = "normal") {
  const state = {
    used: {},
    current: initializeDeck(gameData.deck, gameMode),
    scores: {},
    history: [],
    boardSize: 0,
  };
  state.boardSize = splitDeck(state.current, gameMode, 12).length;

  const events = Array.isArray(gameData.events)
    ? gameData.events.slice()
    : Object.values(gameData.events || {});
  events.sort((first, second) => first.time - second.time);
  events.forEach((event) => {
    if (gameMode === "normal" || gameMode === "setjr") {
      processNormal(state, event);
    } else if (gameMode === "setchain") {
      processChain(state, event);
    } else if (gameMode === "ultraset") {
      processUltra(state, event);
    }
  });

  return {
    current: state.current,
    scores: state.scores,
    history: state.history,
    boardSize: state.boardSize,
  };
}
