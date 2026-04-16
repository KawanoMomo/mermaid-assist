# Phase 1: Sequence Diagram 実装計画

**Goal:** Mermaid Sequence Diagram を Gantt と同等粒度で編集可能にする

**Scope:**
- Core: `participant`/`actor`, `message` (全8種のアロー)
- Sub-elements: `loop`, `alt/else`, `opt`, `par/and`, `note`, `autonumber`
- Operations: add/delete/moveUp/moveDown for participants and messages, add/delete for blocks

**Files:**
- Create: `src/modules/sequence.js`
- Create: `tests/sequence-parser.test.js`, `tests/sequence-updater.test.js`
- Create: `tests/e2e/sequence-basic.spec.js`
- Modify: `mermaid-assist.html`, `src/app.js`, `tests/run-tests.js`

**Syntax reference:**
```
sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello
    B-->>A: Hi
    loop Every minute
        A->>B: Check
    end
    alt success
        A->>B: OK
    else failure
        A->>B: Retry
    end
    opt maybe
        A->>B: Optional
    end
    par parallel
        A->>B: Task1
    and
        B->>A: Task2
    end
    note left of A: Note1
    note over A,B: Spans
    autonumber
```

Arrow types: `->`, `-->`, `->>`, `-->>`, `-x`, `--x`, `-)`, `--)`

## Task structure

### Task 1: Sequence Parser (unit tests first)
- Parse participants/actors with alias
- Parse messages (all 8 arrow types)
- Parse loop/alt/opt/par/note/autonumber blocks
- Return ParsedData with meta, elements, relations, groups

### Task 2: Sequence Updater primitives
- addParticipant, deleteParticipant, moveParticipant
- addMessage (with source/target/arrow/label), deleteMessage, moveMessage
- addBlock (loop/alt/opt/par), deleteBlock
- addNote, deleteNote
- toggleAutonumber

### Task 3: Sequence Module registration
- src/modules/sequence.js exports window.MA.modules.sequence
- DiagramModule v2 interface: type, detect, parse, operations, template

### Task 4: UI integration
- Add "Sequence" to diagram-type select in toolbar
- Register with detectModule path
- Basic buildOverlay: highlight participants and messages on hover/click
- Basic renderProps: participant edit + message edit + block edit forms

### Task 5: E2E tests
- Rendering
- Selection
- Add/delete/reorder
- Block creation

### Task 6: Release v0.6.0
- Bump VERSION
- Merge to master, tag, push
