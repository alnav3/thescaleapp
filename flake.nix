{
  description = "TheScale App - Xiaomi Mi Body Composition Scale S400 Desktop Application";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        python3Env = pkgs.python3.withPackages (ps: with ps; [
          bleak
          cryptography
        ]);
      in
      {
        packages.default = pkgs.buildNpmPackage {
          pname = "thescale-app";
          version = "1.0.0";
          src = ./.;

          npmDepsHash = "sha256-eLHbdcF8MtkEUI7SptOUW64UsU8AmabCgKGvNKCt4aI=";
          makeCacheWritable = true;
          npmBuildScript = "build";
          npmFlags = [ "--ignore-scripts" ];

          nativeBuildInputs = with pkgs; [
            makeWrapper
            nodejs
            copyDesktopItems
          ];

          dontStrip = true;
          dontPatchELF = true;

          desktopItems = [
            (pkgs.makeDesktopItem {
              name = "thescale-app";
              desktopName = "TheScale App";
              comment = "Desktop app for Xiaomi Mi Body Composition Scale S400";
              exec = "thescale-app";
              icon = "thescale-app";
              categories = [ "Utility" "Network" ];
              terminal = false;
            })
          ];

          installPhase = ''
            runHook preInstall

            mkdir -p $out/share/thescale-app
            cp -r dist scripts package.json $out/share/thescale-app/
            cp -r node_modules $out/share/thescale-app/

            mkdir -p $out/share/icons/hicolor/256x256/apps
            if [ -f build/icons/icon.png ]; then
              cp build/icons/icon.png $out/share/icons/hicolor/256x256/apps/thescale-app.png
            fi

            mkdir -p $out/bin
            
            # Create wrapper with XDG fixes
            cat > $out/bin/thescale-app << 'WRAPPER_EOF'
#!/bin/sh
export XDG_DATA_HOME="''${XDG_DATA_HOME:-$HOME/.local/share}"
export XDG_CONFIG_HOME="''${XDG_CONFIG_HOME:-$HOME/.config}"
export NODE_ENV=production
export ELECTRON_IS_DEV=0
export PATH="${pkgs.lib.makeBinPath [ python3Env ]}:$PATH"
export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath [
  pkgs.bluez pkgs.glib pkgs.nss pkgs.nspr pkgs.gtk3 pkgs.at-spi2-atk
  pkgs.at-spi2-core pkgs.cups pkgs.libdrm pkgs.mesa pkgs.libxkbcommon
  pkgs.pango pkgs.cairo pkgs.gdk-pixbuf pkgs.atk pkgs.alsa-lib
  pkgs.libpulseaudio pkgs.xorg.libX11 pkgs.xorg.libXcomposite
  pkgs.xorg.libXdamage pkgs.xorg.libXext pkgs.xorg.libXfixes
  pkgs.xorg.libXrandr pkgs.xorg.libxcb pkgs.xorg.libxshmfence
  pkgs.expat pkgs.libglvnd pkgs.libsecret pkgs.udev pkgs.dbus
]}:$LD_LIBRARY_PATH"
WRAPPER_EOF
            
            # Use quoted heredoc for variable substitution
            cat >> $out/bin/thescale-app << EOF
exec ${pkgs.electron}/bin/electron $out/share/thescale-app "\$@"
EOF
            chmod +x $out/bin/thescale-app

            runHook postInstall
          '';

          postInstall = ''
            # Patch to auto-save measurements from BLE events
            patch_file="$out/share/thescale-app/dist/main/main.cjs"
            
            echo "[FlakeNix] Applying measurement auto-save patch..."
            
            # The fix: When BLE adapter emits a measurement, auto-save it using a guest profile
            # This bypasses the renderer-side issue where measurements aren't being persisted
            # Look for the measurement emission and inject auto-save logic
            sed -i 's/mainWindow\.webContents\.send(IpcChannels\.NATIVE_BLE_MEASUREMENT,/if(global._measurementService){global._measurementService.saveMeasurementAsGuest({weightKg:measurement.weightKg,impedanceOhm:measurement.impedanceOhm,impedanceLowOhm:measurement.impedanceLowOhm,heartRateBpm:measurement.heartRateBpm,isStabilized:measurement.isStabilized,isImpedanceMeasurement:measurement.isImpedanceMeasurement,isHeartRateMeasurement:measurement.isHeartRateMeasurement}).catch(e=>console.error("[AutoSave] Error:",e))};mainWindow.webContents.send(IpcChannels.NATIVE_BLE_MEASUREMENT,/g' "$patch_file" || true
          '';

          meta = with pkgs.lib; {
            description = "Desktop app for Xiaomi Mi Body Composition Scale S400";
            homepage = "https://github.com/alnav3/thescaleapp";
            license = licenses.mit;
            platforms = [ "x86_64-linux" ];
            mainProgram = "thescale-app";
          };
        };

        apps.default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/thescale-app";
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs
            python3Env
            electron
            git
          ];
        };
      }
    );
}
