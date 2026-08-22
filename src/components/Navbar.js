import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import SettingsIcon from "@mui/icons-material/Settings";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import AppBar from "@mui/material/AppBar";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useContext, useState } from "react";
import useSound from "use-sound";

import layoutSfx from "../assets/layoutChangeSound.mp3";
import { SettingsContext } from "../context";
import ColorChoiceDialog from "./ColorChoiceDialog";
import KeyboardLayoutDialog from "./KeyboardLayoutDialog";

function Navbar({
  themeType,
  handleChangeTheme,
  customColors,
  handleCustomColors,
}) {
  const settings = useContext(SettingsContext);
  const [playLayout] = useSound(layoutSfx);
  const [anchorEl, setAnchorEl] = useState(null);
  const [changeCardColors, setChangeCardColors] = useState(false);
  const [changeKeyboardLayout, setChangeKeyboardLayout] = useState(false);

  function handleChangeCardColors(colorMap) {
    setChangeCardColors(false);
    if (colorMap) {
      handleCustomColors({ ...customColors, [themeType]: colorMap });
    }
  }

  return (
    <AppBar position="relative" color="transparent" elevation={0}>
      <Toolbar variant="dense">
        <Typography variant="h6" sx={{ flexGrow: 1, whiteSpace: "nowrap" }}>
          <Link underline="none" color="inherit" href="./">
            Set with Friends
          </Link>
        </Typography>
        <IconButton
          color="inherit"
          aria-label={settings.volume === "on" ? "Mute" : "Unmute"}
          onClick={() =>
            settings.setVolume((value) => (value === "on" ? "off" : "on"))
          }
          size="large"
        >
          <Tooltip title={settings.volume === "on" ? "Mute" : "Unmute"}>
            {settings.volume === "on" ? <VolumeUpIcon /> : <VolumeOffIcon />}
          </Tooltip>
        </IconButton>
        <IconButton
          color="inherit"
          aria-label={themeType === "light" ? "Dark theme" : "Light theme"}
          onClick={handleChangeTheme}
          size="large"
        >
          <Tooltip
            title={themeType === "light" ? "Dark theme" : "Light theme"}
          >
            {themeType === "light" ? (
              <Brightness4Icon />
            ) : (
              <Brightness7Icon />
            )}
          </Tooltip>
        </IconButton>
        <IconButton
          color="inherit"
          aria-label="Settings"
          onClick={(event) => setAnchorEl(event.currentTarget)}
          size="large"
        >
          <Tooltip title="Settings">
            <SettingsIcon />
          </Tooltip>
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          transformOrigin={{ vertical: "top", horizontal: "center" }}
          open={anchorEl !== null}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem
            onClick={() => {
              setChangeCardColors(true);
              setAnchorEl(null);
            }}
          >
            Change card colors
          </MenuItem>
          <MenuItem
            onClick={() => {
              setChangeKeyboardLayout(true);
              setAnchorEl(null);
            }}
          >
            Change keyboard layout
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (settings.volume === "on") playLayout();
              settings.toggleLayoutOrientation();
              settings.toggleCardOrientation();
              setAnchorEl(null);
            }}
          >
            Flip board layout
          </MenuItem>
        </Menu>
        <ColorChoiceDialog
          open={changeCardColors}
          onClose={handleChangeCardColors}
          title="Change Card Colors"
        />
        <KeyboardLayoutDialog
          open={changeKeyboardLayout}
          onClose={() => setChangeKeyboardLayout(false)}
          title="Change Keyboard Layout"
        />
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;
