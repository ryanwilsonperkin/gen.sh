class Gen < Formula
  desc "Generate shell commands using an LLM"
  homepage "https://github.com/ryanwilsonperkin/gen"
  url "https://github.com/ryanwilsonperkin/gen/archive/refs/tags/v0.3.0.tar.gz"
  sha256 "33bdf8dff4d578b0228d7054a47c68a67ad9495363ae5a273da4f16ff7b95445"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", "--production"
    libexec.install "bin", "src", "node_modules", "package.json"
    (bin/"gen").write_env_script libexec/"bin/gen", PATH: "#{Formula["node"].opt_bin}:$PATH"
  end

  def caveats
    <<~EOS
      To enable tab completion, add to your shell config:

        # bash (~/.bashrc)
        eval "$(gen --shell-init bash)"

        # zsh (~/.zshrc)
        eval "$(gen --shell-init zsh)"

        # fish (~/.config/fish/config.fish)
        gen --shell-init fish | source

      Create a config file:
        mkdir -p ~/.config/gen
        cat > ~/.config/gen/genrc.json << 'EOF'
        {
          "provider": "openai",
          "api_key": "sk-...",
          "model": "gpt-4o-mini"
        }
        EOF
    EOS
  end

  test do
    assert_match "gen #{version}", shell_output("#{bin}/gen --version")
  end
end
