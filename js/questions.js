/**
 * Question bank: 12+ per category so tests can randomize 10 unique questions.
 * Each item: question text, options array, correctIndex (0–3).
 */
const QUESTION_BANK = {
  HTML: [
    {
      q: "What does HTML stand for?",
      options: [
        "Hyper Text Markup Language",
        "High Tech Modern Language",
        "Hyperlinks and Text Markup Language",
        "Home Tool Markup Language",
      ],
      correctIndex: 0,
    },
    {
      q: "Which tag is used for the largest heading?",
      options: ["<h6>", "<heading>", "<h1>", "<head>"],
      correctIndex: 2,
    },
    {
      q: "Which attribute provides alternative text for an image?",
      options: ["title", "alt", "src", "href"],
      correctIndex: 1,
    },
    {
      q: "What is the correct HTML element for inserting a line break?",
      options: ["<break>", "<lb>", "<br>", "<line>"],
      correctIndex: 2,
    },
    {
      q: "Which HTML tag defines an unordered list?",
      options: ["<ol>", "<list>", "<ul>", "<li>"],
      correctIndex: 2,
    },
    {
      q: "Which doctype is correct for HTML5?",
      options: [
        "<!DOCTYPE HTML5>",
        "<!DOCTYPE html>",
        "<!DOCTYPE HTML PUBLIC>",
        "<!DOCTYPE XHTML>",
      ],
      correctIndex: 1,
    },
    {
      q: "Which tag is used to define navigation links?",
      options: ["<nav>", "<menu>", "<navigation>", "<header>"],
      correctIndex: 0,
    },
    {
      q: "What is the purpose of the <meta charset='UTF-8'> tag?",
      options: [
        "Set page background",
        "Define character encoding",
        "Load JavaScript",
        "Create a form",
      ],
      correctIndex: 1,
    },
    {
      q: "Which input type is used for email fields?",
      options: ["text", "mail", "email", "e-mail"],
      correctIndex: 2,
    },
    {
      q: "Which tag embeds a video in HTML5?",
      options: ["<movie>", "<media>", "<video>", "<film>"],
      correctIndex: 2,
    },
    {
      q: "What does the <strong> element represent?",
      options: [
        "Italic text",
        "Strong importance (typically bold)",
        "A link",
        "A line break",
      ],
      correctIndex: 1,
    },
    {
      q: "Which attribute opens a link in a new tab?",
      options: [
        "new='tab'",
        "open='new'",
        "target='_blank'",
        "window='new'",
      ],
      correctIndex: 2,
    },
  ],

  CSS: [
    {
      q: "What does CSS stand for?",
      options: [
        "Creative Style Sheets",
        "Cascading Style Sheets",
        "Computer Style Sheets",
        "Colorful Style Sheets",
      ],
      correctIndex: 1,
    },
    {
      q: "Which property changes text color?",
      options: ["font-color", "text-color", "color", "foreground"],
      correctIndex: 2,
    },
    {
      q: "How do you select an element with id 'header'?",
      options: [".header", "#header", "header", "*header"],
      correctIndex: 1,
    },
    {
      q: "Which property controls spacing inside an element's border?",
      options: ["margin", "spacing", "padding", "gap"],
      correctIndex: 2,
    },
    {
      q: "Flexbox: which property aligns items along the main axis?",
      options: ["align-items", "justify-content", "flex-wrap", "align-content"],
      correctIndex: 1,
    },
    {
      q: "Which unit is relative to the font size of the root element?",
      options: ["em", "px", "rem", "%"],
      correctIndex: 2,
    },
    {
      q: "What does 'margin: 0 auto' often do for a block with a width?",
      options: [
        "Hides the element",
        "Centers it horizontally",
        "Makes it full width",
        "Rotates it",
      ],
      correctIndex: 1,
    },
    {
      q: "Which property creates rounded corners?",
      options: ["corner-radius", "border-radius", "round", "radius"],
      correctIndex: 1,
    },
    {
      q: "position: fixed positions an element relative to what?",
      options: [
        "Parent only",
        "The nearest positioned ancestor",
        "The viewport",
        "The document flow only",
      ],
      correctIndex: 2,
    },
    {
      q: "Which selector targets all <p> inside a <div>?",
      options: ["div p", "div > p", "div + p", "div.p"],
      correctIndex: 0,
    },
    {
      q: "What is the default value of flex-direction?",
      options: ["column", "row", "wrap", "inline"],
      correctIndex: 1,
    },
    {
      q: "Which property sets transparency in modern CSS?",
      options: ["visibility", "transparent", "opacity", "alpha"],
      correctIndex: 2,
    },
  ],

  JavaScript: [
    {
      q: "Which keyword declares a block-scoped variable?",
      options: ["var", "let", "function", "global"],
      correctIndex: 1,
    },
    {
      q: "What does === compare?",
      options: [
        "Value only",
        "Type only",
        "Value and type",
        "Nothing",
      ],
      correctIndex: 2,
    },
    {
      q: "Which method adds an item to the end of an array?",
      options: ["push()", "append()", "add()", "insert()"],
      correctIndex: 0,
    },
    {
      q: "What is the output of typeof null in JavaScript?",
      options: ["null", "undefined", "object", "number"],
      correctIndex: 2,
    },
    {
      q: "Which function parses a string to an integer?",
      options: ["parseInt()", "toInteger()", "int()", "Number.parse()"],
      correctIndex: 0,
    },
    {
      q: "What creates a promise in modern JavaScript?",
      options: [
        "new Callback()",
        "new Promise(executor)",
        "Promise.create()",
        "async new Promise()",
      ],
      correctIndex: 1,
    },
    {
      q: "Which method selects a DOM element by id?",
      options: [
        "document.querySelector('#id')",
        "document.getElementById('id')",
        "Both can work",
        "document.findId('id')",
      ],
      correctIndex: 2,
    },
    {
      q: "What is a closure?",
      options: [
        "A loop",
        "A function remembering its outer scope",
        "An error type",
        "A class keyword",
      ],
      correctIndex: 1,
    },
    {
      q: "Which event fires when the DOM is fully loaded?",
      options: ["click", "load", "DOMContentLoaded", "ready"],
      correctIndex: 2,
    },
    {
      q: "What does JSON.stringify do?",
      options: [
        "Parses JSON to object",
        "Converts object to JSON string",
        "Validates HTML",
        "Minifies CSS",
      ],
      correctIndex: 1,
    },
    {
      q: "Which is used to handle errors in async/await?",
      options: ["try/catch", "if/else", "switch", "onerror only"],
      correctIndex: 0,
    },
    {
      q: "What is the result of [1,2,3].map(x => x * 2)?",
      options: [
        "[2,4,6]",
        "6",
        "[1,2,3]",
        "Error",
      ],
      correctIndex: 0,
    },
  ],

  Aptitude: [
    {
      q: "If a shirt costs $40 after a 20% discount, what was the original price?",
      options: ["$45", "$48", "$50", "$52"],
      correctIndex: 2,
    },
    {
      q: "What is 15% of 200?",
      options: ["25", "30", "35", "40"],
      correctIndex: 1,
    },
    {
      q: "A train travels 180 km in 3 hours. What is its average speed?",
      options: ["50 km/h", "55 km/h", "60 km/h", "65 km/h"],
      correctIndex: 2,
    },
    {
      q: "If 5 machines make 5 widgets in 5 minutes, how long for 100 machines to make 100 widgets?",
      options: ["1 min", "5 min", "20 min", "100 min"],
      correctIndex: 1,
    },
    {
      q: "Complete the series: 2, 6, 12, 20, 30, ?",
      options: ["40", "42", "44", "46"],
      correctIndex: 1,
    },
    {
      q: "If x + 3 = 10, what is x?",
      options: ["5", "6", "7", "8"],
      correctIndex: 2,
    },
    {
      q: "A bag has 4 red and 6 blue balls. Probability of drawing red?",
      options: ["0.3", "0.4", "0.5", "0.6"],
      correctIndex: 1,
    },
    {
      q: "Which number is both a square and a cube between 1 and 100?",
      options: ["16", "27", "64", "81"],
      correctIndex: 2,
    },
    {
      q: "If A is taller than B and B is taller than C, who is shortest?",
      options: ["A", "B", "C", "Cannot tell"],
      correctIndex: 2,
    },
    {
      q: "Simple interest on $500 at 4% for 2 years?",
      options: ["$20", "$30", "$40", "$50"],
      correctIndex: 2,
    },
    {
      q: "How many edges does a cube have?",
      options: ["6", "8", "10", "12"],
      correctIndex: 3,
    },
    {
      q: "If code 123 means 'hot', 124 means 'day', what might 12 mean?",
      options: ["h", "ho", "hot", "Cannot determine"],
      correctIndex: 3,
    },
  ],
};

/** Number of questions per test */
const QUESTIONS_PER_TEST = 10;

/**
 * Fisher–Yates shuffle (copy array first).
 */
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/**
 * Returns 10 random questions for the category (with shuffled option order per question).
 */
function getRandomQuestions(category) {
  const bank = QUESTION_BANK[category];
  if (!bank || bank.length < QUESTIONS_PER_TEST) {
    return [];
  }
  const picked = shuffleArray(bank).slice(0, QUESTIONS_PER_TEST);
  return picked.map((item) => {
    const opts = item.options.map((text, idx) => ({ text, originalIndex: idx }));
    const shuffled = shuffleArray(opts);
    const correctNewIndex = shuffled.findIndex(
      (o) => o.originalIndex === item.correctIndex
    );
    return {
      question: item.q,
      options: shuffled.map((o) => o.text),
      correctIndex: correctNewIndex,
    };
  });
}
