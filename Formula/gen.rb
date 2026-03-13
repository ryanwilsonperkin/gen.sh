class Gen < Formula
  desc "Generate shell commands using an LLM"
  homepage "https://github.com/ryanwilsonperkin/gen.sh"
  url "https://github.com/ryanwilsonperkin/gen.sh/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "4b3872e32299d92f7a52b4b0dae9fc1a283e80aee4ef9e638634229ea2e1e5f4"
  license "MIT"

  depends_on "curl"
  depends_on "jq" => :recommended

  def install
    bin.install "bin/gen"
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
