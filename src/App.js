import CssBaseline from "@mui/material/CssBaseline";
import { StyledEngineProvider, ThemeProvider } from "@mui/material/styles";
import { useEffect, useMemo } from "react";

import Navbar from "./components/Navbar";
import { SettingsContext } from "./context";
import useStorage from "./hooks/useStorage";
import OfflineGamePage from "./pages/OfflineGamePage";
import "./styles.css";
import { darkTheme, lightTheme } from "./themes";

function parseCustomColors(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function withCustomColors(theme, colors) {
  return colors
    ? {
        ...theme,
        custom: {
          ...theme.custom,
          setCard: { ...theme.custom.setCard, ...colors },
        },
      }
    : theme;
}

function App() {
  const [themeType, setThemeType] = useStorage("theme", "light");
  const [customColors, setCustomColors] = useStorage("customColors", "{}");
  const [keyboardLayout, setKeyboardLayout] = useStorage(
    "keyboardLayout",
    "QWERTY",
  );
  const [layoutOrientation, setLayoutOrientation] = useStorage(
    "layout",
    "portrait",
  );
  const [cardOrientation, setCardOrientation] = useStorage(
    "orientation",
    "vertical",
  );
  const [volume, setVolume] = useStorage("volume", "on");

  const parsedColors = useMemo(
    () => parseCustomColors(customColors),
    [customColors],
  );
  const theme = useMemo(
    () =>
      themeType === "light"
        ? withCustomColors(lightTheme, parsedColors.light)
        : withCustomColors(darkTheme, parsedColors.dark),
    [themeType, parsedColors],
  );

  useEffect(() => {
    document.documentElement.style.colorScheme = themeType;
  }, [themeType]);

  const toggleLayoutOrientation = () => {
    setLayoutOrientation((value) =>
      value === "portrait" ? "landscape" : "portrait",
    );
  };
  const toggleCardOrientation = () => {
    setCardOrientation((value) =>
      value === "vertical" ? "horizontal" : "vertical",
    );
  };

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SettingsContext.Provider
          value={{
            keyboardLayout,
            setKeyboardLayout,
            volume,
            setVolume,
            layoutOrientation,
            toggleLayoutOrientation,
            cardOrientation,
            toggleCardOrientation,
          }}
        >
          <Navbar
            themeType={themeType}
            handleChangeTheme={() =>
              setThemeType((value) =>
                value === "light" ? "dark" : "light",
              )
            }
            customColors={parsedColors}
            handleCustomColors={(colors) =>
              setCustomColors(JSON.stringify(colors))
            }
          />
          <OfflineGamePage />
        </SettingsContext.Provider>
      </ThemeProvider>
    </StyledEngineProvider>
  );
}

export default App;
