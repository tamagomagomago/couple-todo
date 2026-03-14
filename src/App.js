import React, { useState, useEffect } from "react";

const STORAGE_KEY = "couple-todo-list";
const NAME_STORAGE_KEY = "couple-names";
const CATEGORY_STORAGE_KEY = "couple-categories";
const FILTER_STORAGE_KEY = "couple-category-filter";

const DEFAULT_CATEGORIES = [
  { id: "travel", name: "旅行" },
  { id: "daily", name: "日常" },
  { id: "food", name: "食事" },
];

const getTimeSlot = () => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "evening";
  return "night";
};

const getBackgroundForTheme = (slot, variant) => {
  // variant: "primary" or "alt"
  if (slot === "morning") {
    return variant === "primary"
      ? "linear-gradient(135deg, #ffb36b 0%, #ffdd9a 35%, #ffe9c7 70%, #ffffff 100%)"
      : "radial-gradient(circle at top, #ff9a73 0%, #ffc76b 40%, #fff4df 80%)";
  }
  if (slot === "day") {
    return variant === "primary"
      ? "linear-gradient(135deg, #45b2ff 0%, #81d7ff 40%, #ffffff 80%)"
      : "radial-gradient(circle at top, #2f8cff 0%, #6fd6ff 35%, #f5fbff 80%)";
  }
  if (slot === "evening") {
    return variant === "primary"
      ? "linear-gradient(135deg, #2f7254 0%, #ffb26b 40%, #ffe5b8 80%)"
      : "radial-gradient(circle at top, #275c47 0%, #ffa65c 35%, #ffe9cf 80%)";
  }
  // night
  return variant === "primary"
    ? "linear-gradient(135deg, #050b24 0%, #081736 35%, #102a4c 70%, #1c4469 100%)"
    : "radial-gradient(circle at top, #020615 0%, #071a3a 35%, #123f63 75%, #040914 100%)";
};

const BACKGROUND_IMAGES = [
  { id: "morning", src: "/yuki_bench.jpg", slot: "morning" },
  { id: "day", src: "/shinjukueki.jpg", slot: "day" },
  { id: "evening", src: "/takashimaya.jpg", slot: "evening" },
  { id: "night", src: "/tokyo_tower_river.jpg", slot: "night" },
  { id: "winter", src: "/Yuki_bench.jpg", slot: "morning" },
];

function App() {
  const [tasks, setTasks] = useState([]);
  const [text, setText] = useState("");
  const [owner, setOwner] = useState("partner1");
  const [nameA, setNameA] = useState("A");
  const [nameB, setNameB] = useState("B");
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    DEFAULT_CATEGORIES[0]?.id || ""
  );
  const [filterCategoryId, setFilterCategoryId] = useState("all");
  const [theme, setTheme] = useState({
    slot: getTimeSlot(),
    variant: "primary",
  });
  const [bgIndex, setBgIndex] = useState(() => {
    const slot = getTimeSlot();
    const found = BACKGROUND_IMAGES.findIndex((img) => img.slot === slot);
    return found === -1 ? 0 : found;
  });
  const [isBtnHover, setIsBtnHover] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setTasks(parsed);
        }
      } catch (e) {
        console.error(e);
      }
    }

    const savedNames = localStorage.getItem(NAME_STORAGE_KEY);
    if (savedNames) {
      try {
        const parsed = JSON.parse(savedNames);
        if (parsed && typeof parsed === "object") {
          if (typeof parsed.nameA === "string") {
            setNameA(parsed.nameA);
          }
          if (typeof parsed.nameB === "string") {
            setNameB(parsed.nameB);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    const savedCategories = localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (savedCategories) {
      try {
        const parsed = JSON.parse(savedCategories);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCategories(parsed);
          setSelectedCategoryId(parsed[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    }

    const savedFilter = localStorage.getItem(FILTER_STORAGE_KEY);
    if (savedFilter) {
      setFilterCategoryId(savedFilter);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(
      NAME_STORAGE_KEY,
      JSON.stringify({ nameA, nameB })
    );
  }, [nameA, nameB]);

  useEffect(() => {
    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(FILTER_STORAGE_KEY, filterCategoryId);
  }, [filterCategoryId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTheme((prev) => ({
        ...prev,
        variant: prev.variant === "primary" ? "alt" : "primary",
      }));
    }, 30000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % BACKGROUND_IMAGES.length);
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const handleAdd = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    const newTask = {
      id: Date.now(),
      text: trimmed,
      owner,
      done: false,
      categoryId: selectedCategoryId || "",
    };
    setTasks((prev) => [newTask, ...prev]);
    setText("");
  };

  const toggleDone = (id) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              done: !t.done,
            }
          : t
      )
    );
  };

  const removeTask = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const ownerLabel = (o) =>
    o === "partner1" ? nameA || "A" : nameB || "B";

  const categoryLabel = (id) => {
    if (!id) return "カテゴリなし";
    const c = categories.find((cat) => cat.id === id);
    return c ? c.name : "カテゴリなし";
  };

  const handleAddCategory = (e) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const id = `cat-${Date.now()}`;
    const next = [...categories, { id, name: trimmed }];
    setCategories(next);
    setNewCategoryName("");
    if (!selectedCategoryId) {
      setSelectedCategoryId(id);
    }
  };

  const handleRemoveCategory = (id) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    if (selectedCategoryId === id) {
      setSelectedCategoryId("");
    }
    if (filterCategoryId === id) {
      setFilterCategoryId("all");
    }
  };

  const pageBackground = getBackgroundForTheme(theme.slot, theme.variant);

  const styles = {
    page: {
      minHeight: "100vh",
      margin: 0,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, "Noto Sans JP", sans-serif',
      background:
        "radial-gradient(circle at top left, rgba(249,228,255,0.6), rgba(240,244,255,0.9) 40%, rgba(255,255,255,0.95))",
      color: "#333",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      boxSizing: "border-box",
    },
    card: {
      width: "100%",
      maxWidth: "640px",
      background: "rgba(255,255,255,0.9)",
      boxShadow: "0 18px 45px rgba(0,0,0,0.09)",
      borderRadius: "20px",
      padding: "24px 24px 20px",
      boxSizing: "border-box",
      backdropFilter: "blur(10px)",
      border: "1px solid rgba(255,255,255,0.8)",
    },
    titleArea: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "16px",
    },
    title: {
      fontSize: "22px",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "#333",
    },
    subtitle: {
      fontSize: "12px",
      color: "#999",
    },
    heart: {
      fontSize: "22px",
      color: "#ff7aa2",
    },
    form: {
      display: "flex",
      gap: "8px",
      marginTop: "8px",
      marginBottom: "16px",
      flexWrap: "wrap",
    },
    select: {
      borderRadius: "999px",
      border: "1px solid #ddd",
      padding: "8px 12px",
      fontSize: "14px",
      outline: "none",
      backgroundColor: "#fff",
      color: "#333",
    },
    input: {
      flex: 1,
      minWidth: "160px",
      borderRadius: "999px",
      border: "1px solid #ddd",
      padding: "8px 14px",
      fontSize: "14px",
      outline: "none",
      backgroundColor: "#fff",
      color: "#333",
    },
    button: {
      borderRadius: "999px",
      border: "none",
      padding: "9px 18px",
      fontSize: "14px",
      fontWeight: 600,
      background:
        "linear-gradient(135deg, #ff8fb1, #ffb88f 40%, #ffd39f 80%)",
      color: "#fff",
      cursor: "pointer",
      whiteSpace: "nowrap",
      boxShadow: "0 8px 20px rgba(255,143,177,0.45)",
      transition: "transform 0.08s ease, box-shadow 0.08s ease, filter 0.08s",
    },
    buttonHover: {
      transform: "translateY(-1px)",
      boxShadow: "0 12px 26px rgba(255,143,177,0.55)",
      filter: "brightness(1.02)",
    },
    metaRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "4px",
      fontSize: "12px",
      color: "#999",
    },
    nameRow: {
      display: "flex",
      gap: "8px",
      marginTop: "4px",
      marginBottom: "4px",
      fontSize: "11px",
      color: "#777",
      flexWrap: "wrap",
    },
    nameField: {
      display: "flex",
      alignItems: "center",
      gap: "4px",
    },
    nameLabel: {
      minWidth: "36px",
    },
    nameInput: {
      borderRadius: "999px",
      border: "1px solid #ddd",
      padding: "4px 8px",
      fontSize: "11px",
      outline: "none",
      backgroundColor: "#fff",
      color: "#333",
      width: "110px",
    },
    pillWrapper: {
      display: "flex",
      gap: "8px",
      fontSize: "11px",
    },
    pillA: {
      padding: "3px 10px",
      borderRadius: "999px",
      border: "1px solid #ffd2e3",
      backgroundColor: "#fff5fa",
      color: "#ff7aa2",
    },
    pillB: {
      padding: "3px 10px",
      borderRadius: "999px",
      border: "1px solid #c7dcff",
      backgroundColor: "#f1f5ff",
      color: "#5b7cff",
    },
    counter: {
      fontSize: "11px",
      padding: "3px 10px",
      borderRadius: "999px",
      backgroundColor: "#f5f5f7",
      border: "1px solid #e3e3e8",
      color: "#777",
    },
    categoryRow: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      marginTop: "8px",
      marginBottom: "8px",
      fontSize: "11px",
      color: "#777",
    },
    categoryForm: {
      display: "flex",
      gap: "6px",
      flexWrap: "wrap",
      alignItems: "center",
    },
    categoryInput: {
      borderRadius: "999px",
      border: "1px solid #ddd",
      padding: "4px 8px",
      fontSize: "11px",
      outline: "none",
      backgroundColor: "#fff",
      color: "#333",
      minWidth: "140px",
    },
    categoryAddButton: {
      borderRadius: "999px",
      border: "none",
      padding: "5px 10px",
      fontSize: "11px",
      backgroundColor: "#eef0ff",
      color: "#4b63ff",
      cursor: "pointer",
    },
    categoryChips: {
      display: "flex",
      flexWrap: "wrap",
      gap: "4px",
    },
    categoryChip: {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      padding: "3px 8px",
      borderRadius: "999px",
      backgroundColor: "#f5f5f7",
      border: "1px solid #e3e3e8",
    },
    categoryChipDelete: {
      border: "none",
      padding: 0,
      background: "transparent",
      fontSize: "12px",
      cursor: "pointer",
      color: "#bbb",
    },
    filterSelect: {
      borderRadius: "999px",
      border: "1px solid #e0e0ea",
      padding: "4px 8px",
      fontSize: "11px",
      outline: "none",
      backgroundColor: "#fff",
      color: "#333",
    },
    list: {
      listStyle: "none",
      margin: 0,
      marginTop: "8px",
      padding: 0,
      maxHeight: "420px",
      overflowY: "auto",
    },
    item: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      padding: "10px 10px 9px 6px",
      borderRadius: "14px",
      backgroundColor: "#fafbff",
      border: "1px solid #edf0ff",
      marginBottom: "6px",
    },
    itemLeft: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flex: 1,
      minWidth: 0,
    },
    checkbox: {
      width: "16px",
      height: "16px",
      cursor: "pointer",
      accentColor: "#ff7aa2",
    },
    badgeA: {
      fontSize: "11px",
      padding: "3px 9px",
      borderRadius: "999px",
      backgroundColor: "#ffe3f0",
      color: "#ff5e9a",
      flexShrink: 0,
    },
    badgeB: {
      fontSize: "11px",
      padding: "3px 9px",
      borderRadius: "999px",
      backgroundColor: "#e0e6ff",
      color: "#4b63ff",
      flexShrink: 0,
    },
    text: (done) => ({
      fontSize: "14px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      color: done ? "#aaa" : "#333",
      textDecoration: done ? "line-through" : "none",
    }),
    deleteButton: {
      border: "none",
      background: "transparent",
      cursor: "pointer",
      color: "#ccc",
      fontSize: "16px",
      padding: "0 2px",
      flexShrink: 0,
    },
    emptyState: {
      fontSize: "13px",
      color: "#b5b5c0",
      textAlign: "center",
      padding: "16px 4px 8px",
    },
  };

  const filteredTasks =
    filterCategoryId === "all"
      ? tasks
      : tasks.filter((t) => t.categoryId === filterCategoryId);

  const total = filteredTasks.length;
  const doneCount = filteredTasks.filter((t) => t.done).length;

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
      }}
    >
      {BACKGROUND_IMAGES.map((img, index) => (
        <div
          key={img.id}
          style={{
            position: "fixed",
            inset: 0,
            })`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(8px) brightness(0.96)",
            transform: "scale(1.03)",
            transition: "opacity 1.2s ease-in-out",
            opacity: index === bgIndex ? 1 : 0,
            pointerEvents: "none",
          }}
        />
      ))}
      <div style={styles.page}>
        <div style={styles.card}>
        <div style={styles.titleArea}>
          <div>
            <div style={styles.title}>Our To-Do List</div>
            <div style={styles.subtitle}>
              二人でシェアする、ちょっとした「やりたいこと」。
            </div>
          </div>
          <div style={styles.heart}>♡</div>
        </div>

        <div style={styles.nameRow}>
          <div style={styles.nameField}>
            <span style={styles.nameLabel}>Person 1</span>
            <input
              type="text"
              placeholder="例：Hiroto"
              value={nameA}
              onChange={(e) => setNameA(e.target.value)}
              style={styles.nameInput}
            />
          </div>
          <div style={styles.nameField}>
            <span style={styles.nameLabel}>Person 2</span>
            <input
              type="text"
              placeholder="例：Marina"
              value={nameB}
              onChange={(e) => setNameB(e.target.value)}
              style={styles.nameInput}
            />
          </div>
        </div>

        <form style={styles.categoryForm} onSubmit={handleAddCategory}>
          <span>カテゴリ</span>
          <input
            type="text"
            placeholder="例：記念日、デート、イベント..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            style={styles.categoryInput}
          />
          <button type="submit" style={styles.categoryAddButton}>
            追加
          </button>
        </form>

        <div style={styles.categoryRow}>
          <div style={styles.categoryChips}>
            {categories.map((c) => (
              <span key={c.id} style={styles.categoryChip}>
                {c.name}
                <button
                  type="button"
                  style={styles.categoryChipDelete}
                  onClick={() => handleRemoveCategory(c.id)}
                  aria-label={`${c.name} を削除`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <form style={styles.form} onSubmit={handleAdd}>
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            style={styles.select}
          >
            <option value="partner1">
              {(nameA || "Person 1") + " のやりたいこと"}
            </option>
            <option value="partner2">
              {(nameB || "Person 2") + " のやりたいこと"}
            </option>
          </select>
          <input
            type="text"
            placeholder="例：一緒に京都旅行に行く"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={styles.input}
          />
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            style={styles.select}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            style={{
              ...styles.button,
              ...(isBtnHover ? styles.buttonHover : {}),
            }}
            onMouseEnter={() => setIsBtnHover(true)}
            onMouseLeave={() => setIsBtnHover(false)}
          >
            追加
          </button>
        </form>

        <div style={styles.metaRow}>
          <div style={styles.pillWrapper}>
            <span style={styles.pillA}>{nameA || "Person 1"}</span>
            <span style={styles.pillB}>{nameB || "Person 2"}</span>
          </div>
          <select
            style={styles.filterSelect}
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
          >
            <option value="all">すべてのカテゴリ</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}だけ
              </option>
            ))}
          </select>
          <span style={styles.counter}>
            {doneCount} / {total} 達成
          </span>
        </div>

        <ul style={styles.list}>
          {filteredTasks.length === 0 && (
            <li style={styles.emptyState}>
              該当する「やりたい」がありません。カテゴリやフィルターを変えてみましょう。
            </li>
          )}
          {filteredTasks.map((task) => (
            <li key={task.id} style={styles.item}>
              <div style={styles.itemLeft}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={task.done}
                  onChange={() => toggleDone(task.id)}
                />
                <span
                  style={
                    task.owner === "partner1" ? styles.badgeA : styles.badgeB
                  }
                >
                  {ownerLabel(task.owner)}
                </span>
                <span style={styles.text(task.done)}>{task.text}</span>
              </div>
              <div style={{ fontSize: "11px", color: "#999", marginRight: 8 }}>
                {categoryLabel(task.categoryId)}
              </div>
              <button
                type="button"
                onClick={() => removeTask(task.id)}
                style={styles.deleteButton}
                aria-label="削除"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>
      </div>
    </div>
  );
}

export default App;
