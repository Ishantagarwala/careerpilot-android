import test from 'node:test';
import assert from 'node:assert/strict';

// -------------------------------------------------------------
// P12: Study Chat Logic & Markdown Extraction
// -------------------------------------------------------------
function validateChatMessage(message) {
  const trimmed = typeof message === 'string' ? message.trim() : '';
  if (!trimmed) {
    return { valid: false, error: 'Message cannot be empty.' };
  }
  return { valid: true, error: null, message: trimmed };
}

function boundDocumentContexts(docIds) {
  if (!Array.isArray(docIds)) return [];
  return docIds.filter((id) => typeof id === 'string' && id.trim()).slice(0, 3);
}

function parseMarkdownCodeBlocks(content) {
  const codeRegex = /```[\w]*\n([\s\S]*?)```/g;
  const codeBlocks = [];
  let match;

  while ((match = codeRegex.exec(content)) !== null) {
    codeBlocks.push(match[1].trim());
  }

  const mainText = content.replace(codeRegex, '').trim();
  return { mainText, codeBlocks };
}

function resolveThreadState(routeParams, existingMessages) {
  if (routeParams?.newChat === 'true' || routeParams?.newChat === '1') {
    return { activeThreadId: null, messages: [] };
  }
  if (routeParams?.threadId) {
    return { activeThreadId: routeParams.threadId, messages: existingMessages };
  }
  return { activeThreadId: null, messages: [] };
}

// -------------------------------------------------------------
// P13: Conversations Date Grouping & Management
// -------------------------------------------------------------
function groupThreadsByDate(threads, referenceNow = new Date()) {
  const today = [];
  const earlier = [];

  const startOfToday = new Date(
    referenceNow.getFullYear(),
    referenceNow.getMonth(),
    referenceNow.getDate()
  ).getTime();

  for (const t of threads) {
    const threadDate = new Date(t.updatedAt || t.createdAt).getTime();
    if (threadDate >= startOfToday) {
      today.push(t);
    } else {
      earlier.push(t);
    }
  }

  return { today, earlier };
}

function validateThreadTitle(title) {
  const trimmed = typeof title === 'string' ? title.trim() : '';
  if (!trimmed) {
    return { valid: false, error: 'Title is required.' };
  }
  return { valid: true, title: trimmed };
}

function deleteThreadFromList(threads, threadIdToDelete) {
  return threads.filter((t) => t._id !== threadIdToDelete);
}

// -------------------------------------------------------------
// P14: Study Library Selection Logic
// -------------------------------------------------------------
function toggleDocSelection(currentSelected, doc, maxLimit = 3) {
  const exists = currentSelected.some((d) => d.id === doc.id);
  if (exists) {
    return {
      success: true,
      selected: currentSelected.filter((d) => d.id !== doc.id),
      error: null,
    };
  }
  if (currentSelected.length >= maxLimit) {
    return {
      success: false,
      selected: currentSelected,
      error: `You can select up to ${maxLimit} PDFs for your study session. Please deselect another document first.`,
    };
  }
  return {
    success: true,
    selected: [...currentSelected, { id: doc.id, filename: doc.filename }],
    error: null,
  };
}

// -------------------------------------------------------------
// P15: PDF Upload Validation & Formatting
// -------------------------------------------------------------
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

function validatePdfFile(file) {
  if (!file || !file.name) {
    return { valid: false, error: 'No file selected.' };
  }
  const isPdf =
    file.name.toLowerCase().endsWith('.pdf') ||
    file.mimeType === 'application/pdf';
  if (!isPdf) {
    return { valid: false, error: 'Please select a valid PDF file (.pdf).' };
  }
  if (file.size && file.size > MAX_UPLOAD_BYTES) {
    return {
      valid: false,
      error: 'File exceeds the 10 MB maximum limit. Please choose a smaller document.',
    };
  }
  return { valid: true, error: null };
}

function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return 'Ready to analyze';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB · Ready to analyze`;
  }
  return `${Math.round(bytes / 1024)} KB · Ready to analyze`;
}

// -------------------------------------------------------------
// P16: Document Summary Parsing & Tag Extraction
// -------------------------------------------------------------
function parseSections(markdown) {
  if (!markdown) {
    return {
      keyIdeas: '',
      sections: [],
    };
  }

  const lines = markdown.split('\n');
  let keyIdeas = '';
  const sections = [];

  let currentHeading = '';
  let currentBodyLines = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('# ') || line.startsWith('## ') || line.startsWith('### ')) {
      if (currentHeading) {
        sections.push({
          heading: currentHeading,
          body: currentBodyLines.join(' ').replace(/\s+/g, ' ').trim(),
        });
        currentBodyLines = [];
      } else if (!keyIdeas && currentBodyLines.length > 0) {
        keyIdeas = currentBodyLines.join(' ').replace(/\s+/g, ' ').trim();
        currentBodyLines = [];
      }
      currentHeading = line.replace(/^#+\s*/, '');
    } else if (line) {
      currentBodyLines.push(line.replace(/[*_`]/g, ''));
    }
  }

  if (currentHeading && currentBodyLines.length > 0) {
    sections.push({
      heading: currentHeading,
      body: currentBodyLines.join(' ').replace(/\s+/g, ' ').trim(),
    });
  } else if (!keyIdeas && currentBodyLines.length > 0) {
    keyIdeas = currentBodyLines.join(' ').replace(/\s+/g, ' ').trim();
  }

  if (!keyIdeas && sections.length > 0) {
    keyIdeas = sections[0].body;
  }

  return { keyIdeas, sections };
}

function extractTags(text) {
  if (!text) return ['Notes', 'Summary'];
  const words = text.match(/\b[A-Z][a-zA-Z0-9-]{2,}\b/g) || [];
  const unique = Array.from(new Set(words))
    .filter((w) => !['The', 'This', 'These', 'What', 'How', 'With', 'From', 'When', 'Here', 'Instead'].includes(w))
    .slice(0, 4);
  return unique.length > 0 ? unique : ['Key ideas', 'Concepts'];
}

// -------------------------------------------------------------
// P17: Quiz Filtering & Scoring Logic
// -------------------------------------------------------------
function filterMcqQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  return questions.filter(
    (q) => q.type === 'mcq' || (Array.isArray(q.options) && q.options.length > 0)
  );
}

function evaluateAnswer(question, selectedOption) {
  if (!selectedOption) return { checked: false, isCorrect: false };
  const isCorrect =
    selectedOption.trim().toLowerCase() === question.answer.trim().toLowerCase();
  return { checked: true, isCorrect };
}

// -------------------------------------------------------------
// P18: Flashcards Filtering & Navigation Boundaries
// -------------------------------------------------------------
function filterFlashcards(questions) {
  if (!Array.isArray(questions)) return [];
  const flashcardItems = questions.filter(
    (q) => q.type === 'flashcard' || (!q.options || q.options.length === 0)
  );
  return flashcardItems.length > 0 ? flashcardItems : questions;
}

function getNextCardIndex(currentIndex, totalCards) {
  if (totalCards <= 0) return 0;
  return currentIndex < totalCards - 1 ? currentIndex + 1 : 0;
}

function getPrevCardIndex(currentIndex, totalCards) {
  if (totalCards <= 0) return 0;
  return currentIndex > 0 ? currentIndex - 1 : totalCards - 1;
}

// =============================================================
// TEST SUITE: PHASE 5 — AI Study Hub & Document Learning
// =============================================================

test('P12: Chat message validation - rejects empty and trims whitespace', () => {
  assert.equal(validateChatMessage('').valid, false);
  assert.equal(validateChatMessage('   \n  \t  ').valid, false);

  const res = validateChatMessage('  Explain binary search trees  ');
  assert.equal(res.valid, true);
  assert.equal(res.message, 'Explain binary search trees');
});

test('P12: Document context bounds - strictly enforces maximum of 3 document IDs', () => {
  const ids = ['doc-1', 'doc-2', 'doc-3', 'doc-4', 'doc-5'];
  const bounded = boundDocumentContexts(ids);
  assert.equal(bounded.length, 3);
  assert.deepEqual(bounded, ['doc-1', 'doc-2', 'doc-3']);

  assert.deepEqual(boundDocumentContexts(null), []);
  assert.deepEqual(boundDocumentContexts(['doc-1', '   ', 'doc-2']), ['doc-1', 'doc-2']);
});

test('P12: Code block parser - extracts fenced markdown and preserves surrounding text', () => {
  const raw = `Here is how to create a table in SQL:
\`\`\`sql
CREATE TABLE students (
  id INT PRIMARY KEY,
  name VARCHAR(100)
);
\`\`\`
Make sure the primary key is unique.`;

  const parsed = parseMarkdownCodeBlocks(raw);
  assert.equal(parsed.codeBlocks.length, 1);
  assert.ok(parsed.codeBlocks[0].includes('CREATE TABLE students'));
  assert.ok(parsed.mainText.includes('Here is how to create a table'));
  assert.ok(parsed.mainText.includes('Make sure the primary key is unique.'));
});

test('P12: New conversation state - does not carry old messages into new thread', () => {
  const previousMessages = [
    { role: 'user', content: 'Old question' },
    { role: 'assistant', content: 'Old answer' },
  ];

  const stateNew = resolveThreadState({ newChat: 'true' }, previousMessages);
  assert.equal(stateNew.activeThreadId, null);
  assert.equal(stateNew.messages.length, 0);

  const stateExisting = resolveThreadState({ threadId: 'thread_123' }, previousMessages);
  assert.equal(stateExisting.activeThreadId, 'thread_123');
  assert.equal(stateExisting.messages.length, 2);
});

test('P13: Conversations date grouping - groups into TODAY and EARLIER based on midnight', () => {
  const mockNow = new Date('2026-10-04T12:00:00Z');

  const threads = [
    {
      _id: 't1',
      threadTitle: 'Database normalization',
      updatedAt: '2026-10-04T09:30:00Z', // Today
    },
    {
      _id: 't2',
      threadTitle: 'Python practice',
      updatedAt: '2026-10-03T18:00:00Z', // Yesterday (Earlier)
    },
    {
      _id: 't3',
      threadTitle: 'Roadmap planning',
      updatedAt: '2026-10-01T10:00:00Z', // Earlier
    },
  ];

  const grouped = groupThreadsByDate(threads, mockNow);
  assert.equal(grouped.today.length, 1);
  assert.equal(grouped.today[0].threadTitle, 'Database normalization');
  assert.equal(grouped.earlier.length, 2);
  assert.equal(grouped.earlier[0].threadTitle, 'Python practice');
});

test('P13: Thread title update validation and list deletion', () => {
  assert.equal(validateThreadTitle('').valid, false);
  assert.equal(validateThreadTitle('   ').valid, false);
  assert.equal(validateThreadTitle('  New Title  ').title, 'New Title');

  const threads = [
    { _id: 't1', threadTitle: 'Thread 1' },
    { _id: 't2', threadTitle: 'Thread 2' },
  ];

  const remaining = deleteThreadFromList(threads, 't1');
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]._id, 't2');
});

test('P14: Study materials selection limit - allows up to 3 and rejects 4th with error message', () => {
  let selected = [
    { id: 'doc-1', filename: 'Doc 1.pdf' },
    { id: 'doc-2', filename: 'Doc 2.pdf' },
  ];

  // Adding 3rd document succeeds
  const res3 = toggleDocSelection(selected, { id: 'doc-3', filename: 'Doc 3.pdf' });
  assert.equal(res3.success, true);
  assert.equal(res3.selected.length, 3);
  selected = res3.selected;

  // Adding 4th document is rejected with explanatory error
  const res4 = toggleDocSelection(selected, { id: 'doc-4', filename: 'Doc 4.pdf' });
  assert.equal(res4.success, false);
  assert.equal(res4.selected.length, 3);
  assert.ok(res4.error?.includes('select up to 3 PDFs'));

  // Deselecting one works
  const resDeselect = toggleDocSelection(selected, { id: 'doc-2', filename: 'Doc 2.pdf' });
  assert.equal(resDeselect.success, true);
  assert.equal(resDeselect.selected.length, 2);
});

test('P15: PDF upload validation - accepts valid PDF and enforces 10 MB limit', () => {
  // Valid PDF
  const validFile = { name: 'OperatingSystems.pdf', size: 2.5 * 1024 * 1024, mimeType: 'application/pdf' };
  assert.equal(validatePdfFile(validFile).valid, true);

  // Non-PDF rejection
  const invalidFile = { name: 'Resume.docx', size: 500 * 1024, mimeType: 'application/msword' };
  const resNonPdf = validatePdfFile(invalidFile);
  assert.equal(resNonPdf.valid, false);
  assert.ok(resNonPdf.error?.includes('valid PDF file'));

  // Oversized PDF rejection (> 10MB)
  const oversizedFile = { name: 'LargeBook.pdf', size: 12 * 1024 * 1024, mimeType: 'application/pdf' };
  const resOversized = validatePdfFile(oversizedFile);
  assert.equal(resOversized.valid, false);
  assert.ok(resOversized.error?.includes('10 MB'));
});

test('P15: File size string formatting', () => {
  assert.equal(formatFileSize(2.4 * 1024 * 1024), '2.4 MB · Ready to analyze');
  assert.equal(formatFileSize(512 * 1024), '512 KB · Ready to analyze');
  assert.equal(formatFileSize(null), 'Ready to analyze');
});

test('P16: Document summary parser - splits headings into structured sections', () => {
  const sampleMarkdown = `## Key ideas
Organize data into related tables, retrieve it with SQL, and reduce duplication through normalization.

## 1. Relational databases
Tables store entities. A primary key identifies a row; a foreign key connects related rows.

## 2. Normalization
Separate repeated information so updates happen in one place.

## 3. Querying with SQL
Use SELECT to read data, JOIN to connect tables, and WHERE to filter results.`;

  const parsed = parseSections(sampleMarkdown);
  assert.ok(parsed.keyIdeas.includes('Organize data into related tables'));
  assert.equal(parsed.sections.length, 4);
  assert.equal(parsed.sections[1].heading, '1. Relational databases');
  assert.ok(parsed.sections[1].body.includes('Tables store entities'));

  const tags = extractTags(sampleMarkdown);
  assert.ok(tags.includes('SQL') || tags.includes('Tables'));
});

test('P17: Practice quiz - filters MCQs and evaluates correct/incorrect answers', () => {
  const rawQuestions = [
    {
      question: 'What is database normalization?',
      options: ['Run faster', 'Reduce duplication', 'Delete tables', 'Single table'],
      answer: 'Reduce duplication',
      type: 'mcq',
    },
    {
      question: 'What is a foreign key?',
      answer: 'A link to a primary key in another table',
      type: 'flashcard',
    },
    {
      question: 'What keyword connects tables in SQL?',
      options: ['JOIN', 'LINK', 'MERGE', 'ATTACH'],
      answer: 'JOIN',
      type: 'mcq',
    },
  ];

  const mcqs = filterMcqQuestions(rawQuestions);
  assert.equal(mcqs.length, 2);
  assert.equal(mcqs[0].question, 'What is database normalization?');
  assert.equal(mcqs[1].question, 'What keyword connects tables in SQL?');

  // Correct answer
  const correctEval = evaluateAnswer(mcqs[0], 'Reduce duplication');
  assert.equal(correctEval.checked, true);
  assert.equal(correctEval.isCorrect, true);

  // Incorrect answer
  const wrongEval = evaluateAnswer(mcqs[0], 'Run faster');
  assert.equal(wrongEval.checked, true);
  assert.equal(wrongEval.isCorrect, false);

  // Unselected cannot be checked
  const unselectedEval = evaluateAnswer(mcqs[0], null);
  assert.equal(unselectedEval.checked, false);
});

test('P18: Flashcards - extracts flashcard questions and handles circular navigation', () => {
  const rawQuestions = [
    {
      question: 'What is database normalization?',
      options: ['Run faster', 'Reduce duplication'],
      answer: 'Reduce duplication',
      type: 'mcq',
    },
    {
      question: 'What is a foreign key?',
      answer: 'A field that links a row to a primary key in another table.',
      type: 'flashcard',
    },
    {
      question: 'What does a JOIN do?',
      answer: 'Combines related rows from two or more tables.',
      type: 'flashcard',
    },
  ];

  const cards = filterFlashcards(rawQuestions);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].question, 'What is a foreign key?');
  assert.equal(cards[1].question, 'What does a JOIN do?');

  // Forward navigation
  assert.equal(getNextCardIndex(0, 2), 1);
  assert.equal(getNextCardIndex(1, 2), 0); // Wraps around to start

  // Backward navigation
  assert.equal(getPrevCardIndex(1, 2), 0);
  assert.equal(getPrevCardIndex(0, 2), 1); // Wraps around to end
});
